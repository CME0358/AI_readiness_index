/** Homepage public Check — lightweight HTML observations only. */
import dns from 'node:dns/promises';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { normalizeDomain } from './lead-capture.mjs';
import { localGeoDestination } from './routing.mjs';

const PUBLIC_CHECK_LIMITS = Object.freeze({
  timeoutMs: 15000,
  maxBytes: 512 * 1024,
  maxRedirects: 3,
});

const APEX_WWW_FALLBACK_STATUSES = new Set([521, 522, 523, 524, 525, 526]);

const FINDING_CODES = Object.freeze({
  AI_DISCOVERABILITY_SIGNAL: 'AI_DISCOVERABILITY_SIGNAL',
  COMPARISON_INFORMATION_SIGNAL: 'COMPARISON_INFORMATION_SIGNAL',
  ACTIONABILITY_SIGNAL: 'ACTIONABILITY_SIGNAL',
});

const NEXT_STEPS = Object.freeze({
  learn: Object.freeze({
    href: '/whitepaper/2026/free/',
    label: '無料ガイドを見る',
    ctaType: 'LEARN',
    ctaId: 'homepage_check_learn',
  }),
  report: Object.freeze({
    href: '/report/',
    label: '詳しい原因と改善優先順位を確認する',
    ctaType: 'REPORT',
    ctaId: 'homepage_check_report',
  }),
  local: Object.freeze({
    href: homepageLocalDestination(),
    label: '店舗・クリニックの集客改善を任せたい',
    ctaType: 'LOCAL',
    ctaId: 'homepage_check_local',
  }),
});

const FETCH_HEADERS = Object.freeze({
  Accept: 'text/html,application/xhtml+xml;q=0.9',
  'Accept-Language': 'ja,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; AgentReadinessCheck/1.0; +https://readiness.coaretail.com)',
});

function homepageLocalDestination() {
  const url = new URL(localGeoDestination());
  url.searchParams.set('utm_content', 'homepage_check');
  return url.toString();
}

function ipv4ToInt(ip) {
  const parts = String(ip).split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIpv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  if (n <= 0x00ffffff) return true;
  if (n >= 0x0a000000 && n <= 0x0affffff) return true;
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true;
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true;
  if (n >= 0xac100000 && n <= 0xac1fffff) return true;
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true;
  if (n >= 0xc0000000 && n <= 0xc00000ff) return true;
  if (n >= 0xe0000000) return true;
  return false;
}

function mappedIpv4(ip) {
  const match = String(ip).match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return match ? match[1] : null;
}

function isBlockedIp(ip) {
  const value = String(ip || '').replace(/^\[|\]$/g, '');
  const v4 = mappedIpv4(value);
  if (v4) return isBlockedIpv4(v4);
  const kind = net.isIP(value);
  if (kind === 4) return isBlockedIpv4(value);
  if (kind === 6) {
    const lower = value.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('ff')) return true;
    return false;
  }
  return true;
}

function resolvePublicCheckTarget(input) {
  const raw = String(input || '').trim();
  if (!raw) return { valid: false, reason: 'invalid_url' };
  const domain = normalizeDomain(raw);
  if (!domain.valid) return { valid: false, reason: domain.reason || 'invalid_url' };

  let fetchHostname = domain.value;
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      fetchHostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    }
  } catch {
    // keep canonical hostname
  }

  const isApexInput = !fetchHostname.startsWith('www.') && fetchHostname === domain.value;

  return {
    valid: true,
    host: domain.value,
    fetchHostname,
    href: `https://${fetchHostname}/`,
    isApexInput,
  };
}

function isCloudflareAddress(address) {
  const ip = String(address || '');
  if (ip.startsWith('104.21.') || ip.startsWith('104.22.') || ip.startsWith('104.23.') || ip.startsWith('104.24.') || ip.startsWith('104.25.') || ip.startsWith('104.26.') || ip.startsWith('104.27.')) return true;
  if (ip.startsWith('172.67.') || ip.startsWith('172.68.') || ip.startsWith('172.69.') || ip.startsWith('172.70.') || ip.startsWith('172.71.')) return true;
  return false;
}

async function lookupPublicIpv4(hostname, lookup = dns.lookup) {
  const records = await lookup(hostname, { all: true, family: 4, verbatim: true });
  const list = Array.isArray(records) ? records : records?.address ? [records] : [];
  return list.filter((record) => record.family === 4 || !record.family);
}

async function assertPublicHostname(hostname, lookup = dns.lookup) {
  const list = await lookupPublicIpv4(hostname, lookup);
  if (!list.length) {
    const err = new Error('unresolved_host');
    err.code = 'unresolved_host';
    throw err;
  }
  for (const record of list) {
    if (isBlockedIp(record.address)) {
      const err = new Error('blocked_address');
      err.code = 'blocked_address';
      throw err;
    }
  }
  return list;
}

function extractResponseMetadata(res) {
  const headers = res?.headers;
  const get = (key) => headers?.get?.(key) ?? null;
  return {
    httpStatus: Number(res?.status) || null,
    cfRay: get('cf-ray'),
    server: get('server'),
    serverTiming: get('server-timing'),
    cfCacheStatus: get('cf-cache-status'),
  };
}

function hasCloudflareChallengeEvidence(headers, bodySnippet = '') {
  const body = String(bodySnippet || '').toLowerCase();
  const mitigated = headers?.get?.('cf-mitigated');
  if (mitigated && String(mitigated).toLowerCase().includes('challenge')) return true;
  return body.includes('cf-browser-verification')
    || body.includes('challenge-platform')
    || body.includes('just a moment')
    || body.includes('attention required');
}

function classifyHttpStatus(status, headers = {}, bodySnippet = '') {
  const challenge = hasCloudflareChallengeEvidence(headers, bodySnippet);
  switch (status) {
    case 403: return challenge ? 'cloudflare_protected' : 'access_denied';
    case 429: return 'rate_limited';
    case 503: return challenge ? 'cloudflare_protected' : 'service_unavailable';
    case 520: return 'origin_unknown_error';
    case 521: return 'origin_down';
    case 522: return 'origin_connection_timeout';
    case 523: return 'origin_unreachable';
    case 524: return 'origin_timeout';
    case 525: return 'ssl_origin_error';
    case 526: return 'invalid_origin_certificate';
    case 530: return 'origin_dns_or_edge_error';
    default: return 'unreachable';
  }
}

function isAbortError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  if (error.code === 20 || error.code === 'ABORT_ERR') return true;
  return false;
}

function classifyFetchFailure(error) {
  if (isAbortError(error)) return 'timeout';

  const name = error?.name || '';
  const code = error?.code || '';
  const message = String(error?.message || '');
  const status = Number(error?.httpStatus);

  if (Number.isFinite(status) && status > 0) {
    return classifyHttpStatus(status, error?.responseHeaders, error?.bodySnippet);
  }

  if (name === 'TimeoutError' || message.includes('timeout') || message === 'timeout') {
    return 'timeout';
  }
  if (code === 'blocked_address' || message === 'blocked_address') return 'blocked_target';
  if (code === 'unresolved_host') return 'unreachable';
  if (message === 'redirect_loop' || message === 'too_many_redirects') return 'unreachable';
  if (message === 'non_html') return 'non_html';
  if (message === 'oversized') return 'unreachable';
  return 'unreachable';
}

function userFacingError(internalCode) {
  const slow = new Set(['timeout', 'origin_timeout', 'origin_connection_timeout', 'service_unavailable', 'rate_limited']);
  const ssl = new Set(['ssl_origin_error', 'invalid_origin_certificate']);
  const restricted = new Set(['access_denied', 'cloudflare_protected']);
  const connection = new Set([
    'unreachable', 'origin_down', 'origin_unreachable', 'origin_unknown_error', 'origin_dns_or_edge_error',
  ]);
  if (slow.has(internalCode)) return 'slow_response';
  if (ssl.has(internalCode)) return 'ssl_connection';
  if (restricted.has(internalCode)) return 'access_restricted';
  if (connection.has(internalCode)) return 'connection_failed';
  return internalCode;
}

function httpStatusForError(internalCode) {
  if (internalCode === 'invalid_url') return 400;
  if (internalCode === 'non_html') return 422;
  if (internalCode === 'blocked_target') return 400;
  if (['access_denied', 'cloudflare_protected', 'rate_limited'].includes(internalCode)) return 503;
  if (['timeout', 'origin_timeout', 'origin_connection_timeout', 'service_unavailable'].includes(internalCode)) return 504;
  if (['ssl_origin_error', 'invalid_origin_certificate'].includes(internalCode)) return 502;
  return 502;
}

function isHtmlContentType(value) {
  const type = String(value || '').split(';')[0].trim().toLowerCase();
  if (!type) return true;
  return type === 'text/html' || type === 'application/xhtml+xml' || type === 'text/plain';
}

function createRequestDeadline(budgetMs) {
  const controller = new AbortController();
  const started = performance.now();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  return {
    signal: controller.signal,
    elapsedMs: () => Math.round(performance.now() - started),
    dispose: () => clearTimeout(timer),
  };
}

async function readBoundedBody(res, maxBytes, signal) {
  const declared = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('oversized');
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (signal?.aborted) throw signal.reason || new DOMException('The operation was aborted', 'AbortError');
    if (Buffer.byteLength(text) > maxBytes) throw new Error('oversized');
    return text;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw signal.reason || new DOMException('The operation was aborted', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error('oversized');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

function buildFetchError(status, headers, bodySnippet = '') {
  const err = new Error('http_error');
  err.httpStatus = status;
  err.responseHeaders = headers;
  err.bodySnippet = bodySnippet;
  err.cfRay = headers?.get?.('cf-ray') ?? null;
  return err;
}

async function fetchPublicDocument(startHref, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const lookup = deps.lookup || dns.lookup;
  const budgetMs = deps.timeoutMs || PUBLIC_CHECK_LIMITS.timeoutMs;
  const deadline = createRequestDeadline(budgetMs);
  let current = startHref;
  const seen = new Set();

  try {
    for (let hop = 0; hop <= PUBLIC_CHECK_LIMITS.maxRedirects; hop += 1) {
      const parsed = new URL(current);
      if (parsed.protocol !== 'https:') {
        const err = new Error('blocked_address');
        err.code = 'blocked_address';
        throw err;
      }
      const target = resolvePublicCheckTarget(parsed.hostname);
      if (!target.valid) {
        const err = new Error('blocked_address');
        err.code = 'blocked_address';
        throw err;
      }
      await assertPublicHostname(parsed.hostname, lookup);
      if (seen.has(current)) throw new Error('redirect_loop');
      seen.add(current);

      const res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: deadline.signal,
        headers: FETCH_HEADERS,
      });

      const status = res.status;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = res.headers.get('location');
        if (!location) throw new Error('unreachable');
        current = new URL(location, current).toString();
        if (hop === PUBLIC_CHECK_LIMITS.maxRedirects) throw new Error('too_many_redirects');
        continue;
      }

      if (!res.ok) {
        let snippet = '';
        try {
          snippet = await readBoundedBody(res, 4096, deadline.signal);
        } catch {
          // diagnostic snippet is optional
        }
        throw buildFetchError(status, res.headers, snippet);
      }

      if (!isHtmlContentType(res.headers.get('content-type'))) throw new Error('non_html');
      const html = await readBoundedBody(res, PUBLIC_CHECK_LIMITS.maxBytes, deadline.signal);
      const trimmed = html.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('%PDF')) {
        throw new Error('non_html');
      }
      return {
        html,
        finalHref: current,
        metadata: extractResponseMetadata(res),
        elapsedMs: deadline.elapsedMs(),
      };
    }
    throw new Error('too_many_redirects');
  } finally {
    deadline.dispose();
  }
}

function extractHtmlSignals(html) {
  const text = String(html || '');
  const lower = text.toLowerCase();
  const has = (token) => lower.includes(token.toLowerCase());
  return {
    hasSchema: has('schema.org') || has('application/ld+json'),
    hasOg: has('og:title') || has('property="og:') || has("property='og:"),
    hasComparison: /料金|価格|price|料金表|メニュー|プラン|fee/.test(text) || /itemprop=["']price/i.test(text),
    hasAction: has('<form') || /予約|問い合わせ|お問合せ|contact|booking|reserve|mailto:|tel:/.test(lower),
  };
}

function buildFindings(signals) {
  const discoverable = Boolean(signals.hasSchema || signals.hasOg);
  const findings = [];
  if (!discoverable) {
    findings.push({
      code: FINDING_CODES.AI_DISCOVERABILITY_SIGNAL,
      tone: 'gap',
      copy: 'AIがページの意味を読み取るための基本情報（構造化データなど）が不足している可能性があります',
    });
  }
  if (!signals.hasComparison) {
    findings.push({
      code: FINDING_CODES.COMPARISON_INFORMATION_SIGNAL,
      tone: 'gap',
      copy: '比較に必要な情報（料金・プランなどの記述）を確認しづらい状態です',
    });
  }
  if (!signals.hasAction) {
    findings.push({
      code: FINDING_CODES.ACTIONABILITY_SIGNAL,
      tone: 'gap',
      copy: '予約・問い合わせにつながる情報を確認しづらい状態です',
    });
  }
  if (findings.length === 0) {
    findings.push({
      code: FINDING_CODES.AI_DISCOVERABILITY_SIGNAL,
      tone: 'present',
      copy: 'AIが理解するための基本情報は確認できます',
    });
    findings.push({
      code: FINDING_CODES.ACTIONABILITY_SIGNAL,
      tone: 'present',
      copy: '公開ページ上に、行動につながる記述の手がかりがあります',
    });
  }
  return findings.slice(0, 2);
}

function resultCategory(findings) {
  const tones = findings.map((item) => item.tone);
  if (tones.every((tone) => tone === 'gap')) return 'gap';
  if (tones.every((tone) => tone === 'present')) return 'present';
  return 'mixed';
}

function buildAttemptLog({
  normalizedHost,
  attemptedUrl,
  region,
  metadata = {},
  elapsedMs,
  classification,
  fallbackUsed = false,
  initialUrl = null,
  initialStatus = null,
  fallbackUrl = null,
  fallbackStatus = null,
}) {
  return {
    normalizedHost,
    attemptedUrl,
    region,
    httpStatus: metadata.httpStatus ?? null,
    cfRay: metadata.cfRay ?? null,
    server: metadata.server ?? null,
    serverTiming: metadata.serverTiming ?? null,
    cfCacheStatus: metadata.cfCacheStatus ?? null,
    elapsedMs,
    classification,
    fallbackUsed,
    initialUrl,
    initialStatus,
    fallbackUrl,
    fallbackStatus,
  };
}

function logPublicCheckAttempts(attempts, outcome) {
  if (!attempts?.length) return;
  console.log(JSON.stringify({
    event: 'public_check_observability',
    outcome,
    attempts,
  }));
}

function publicView(result) {
  if (!result.ok) {
    return {
      ok: false,
      error: userFacingError(result.error),
      findings: [],
      next: NEXT_STEPS,
    };
  }
  return {
    ok: true,
    host: result.host,
    findings: result.findings.map(({ code, copy }) => ({ code, copy })),
    next: NEXT_STEPS,
  };
}

function assertNoPaidPayload(payload) {
  const raw = JSON.stringify(payload);
  const forbidden = [
    'overallScore', 'scoreBreakdown', 'aiRecognition', 'roadmap', 'certificate',
    'executiveSummary', 'improvementProposals', 'knowledgeCoverage', 'DUMMY_REPORT',
    'Leader', 'Platinum', 'deviation',
  ];
  return !forbidden.some((token) => raw.includes(token));
}

function shouldApexWwwFallback(error, target) {
  if (!target.isApexInput) return false;
  const status = Number(error?.httpStatus);
  return APEX_WWW_FALLBACK_STATUSES.has(status);
}

async function attemptFetch(href, deps, target, region) {
  const started = performance.now();
  try {
    const document = await fetchPublicDocument(href, deps);
    const classification = 'success';
    const attempt = buildAttemptLog({
      normalizedHost: target.host,
      attemptedUrl: href,
      region,
      metadata: document.metadata,
      elapsedMs: document.elapsedMs ?? Math.round(performance.now() - started),
      classification,
      fallbackUsed: false,
    });
    return { ok: true, document, attempt };
  } catch (error) {
    const metadata = {
      httpStatus: error?.httpStatus ?? null,
      cfRay: error?.cfRay ?? null,
      server: error?.responseHeaders?.get?.('server') ?? null,
      serverTiming: error?.responseHeaders?.get?.('server-timing') ?? null,
      cfCacheStatus: error?.responseHeaders?.get?.('cf-cache-status') ?? null,
    };
    const classification = classifyFetchFailure(error);
    const attempt = buildAttemptLog({
      normalizedHost: target.host,
      attemptedUrl: href,
      region,
      metadata,
      elapsedMs: Math.round(performance.now() - started),
      classification,
      fallbackUsed: false,
    });
    return { ok: false, error, attempt, classification };
  }
}

async function runPublicCheck(input = {}, deps = {}) {
  const region = deps.region || process.env.VERCEL_REGION || 'unknown';
  const target = resolvePublicCheckTarget(input.url || input.domain || input);
  if (!target.valid) {
    return {
      ok: false,
      error: 'invalid_url',
      status: 400,
      writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 },
      diagnostics: [],
    };
  }

  const attempts = [];
  const primaryHref = target.href;
  const primary = await attemptFetch(primaryHref, deps, target, region);
  attempts.push(primary.attempt);

  if (primary.ok) {
    const signals = extractHtmlSignals(primary.document.html);
    const findings = buildFindings(signals);
    logPublicCheckAttempts(attempts, 'success');
    return {
      ok: true,
      host: target.host,
      findings,
      resultCategory: resultCategory(findings),
      status: 200,
      writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 },
      diagnostics: attempts,
    };
  }

  let lastError = primary.error;
  let lastClassification = primary.classification;

  const fallbackHref = target.isApexInput ? `https://www.${target.host}/` : null;
  if (fallbackHref && shouldApexWwwFallback(primary.error, target)) {
    const fallbackTarget = resolvePublicCheckTarget(`https://www.${target.host}`);
    const fallback = await attemptFetch(fallbackHref, deps, fallbackTarget, region);
    fallback.attempt.fallbackUsed = true;
    fallback.attempt.initialUrl = primaryHref;
    fallback.attempt.initialStatus = primary.attempt.httpStatus;
    fallback.attempt.fallbackUrl = fallbackHref;
    attempts.push(fallback.attempt);

    if (fallback.ok) {
      fallback.attempt.fallbackStatus = fallback.attempt.httpStatus;
      const signals = extractHtmlSignals(fallback.document.html);
      const findings = buildFindings(signals);
      logPublicCheckAttempts(attempts, 'success_with_fallback');
      return {
        ok: true,
        host: target.host,
        findings,
        resultCategory: resultCategory(findings),
        status: 200,
        writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 },
        diagnostics: attempts,
      };
    }

    fallback.attempt.fallbackStatus = fallback.attempt.httpStatus;
    lastError = fallback.error;
    lastClassification = fallback.classification;
  }

  const errorCode = lastClassification || classifyFetchFailure(lastError);
  logPublicCheckAttempts(attempts, errorCode);
  return {
    ok: false,
    error: errorCode,
    status: httpStatusForError(errorCode),
    writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 },
    diagnostics: attempts,
  };
}

export {
  PUBLIC_CHECK_LIMITS,
  APEX_WWW_FALLBACK_STATUSES,
  FINDING_CODES,
  NEXT_STEPS,
  FETCH_HEADERS,
  isBlockedIp,
  isCloudflareAddress,
  lookupPublicIpv4,
  resolvePublicCheckTarget,
  assertPublicHostname,
  extractResponseMetadata,
  hasCloudflareChallengeEvidence,
  classifyHttpStatus,
  classifyFetchFailure,
  isAbortError,
  userFacingError,
  extractHtmlSignals,
  buildFindings,
  resultCategory,
  publicView,
  assertNoPaidPayload,
  runPublicCheck,
  fetchPublicDocument,
  homepageLocalDestination,
  buildAttemptLog,
  logPublicCheckAttempts,
};
