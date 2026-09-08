/** Homepage public Check — lightweight HTML observations only. */
import dns from 'node:dns/promises';
import net from 'node:net';
import { normalizeDomain } from './lead-capture.mjs';
import { localGeoDestination } from './routing.mjs';

const PUBLIC_CHECK_LIMITS = Object.freeze({
  timeoutMs: 8000,
  maxBytes: 512 * 1024,
  maxRedirects: 3,
});

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

  return {
    valid: true,
    host: domain.value,
    fetchHostname,
    href: `https://${fetchHostname}/`,
  };
}

async function assertPublicHostname(hostname, lookup = dns.lookup) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  const list = Array.isArray(records) ? records : records?.address ? [records] : [];
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

function classifyFetchFailure(error) {
  const name = error?.name || '';
  const code = error?.code || '';
  const message = String(error?.message || '');
  if (name === 'TimeoutError' || code === 'ABORT_ERR' || message.includes('timeout') || message === 'timeout') {
    return 'timeout';
  }
  if (code === 'blocked_address' || message === 'blocked_address') return 'blocked_target';
  if (code === 'unresolved_host') return 'unreachable';
  if (message === 'redirect_loop' || message === 'too_many_redirects') return 'unreachable';
  if (message === 'non_html') return 'non_html';
  if (message === 'oversized') return 'unreachable';
  return 'unreachable';
}

function isHtmlContentType(value) {
  const type = String(value || '').split(';')[0].trim().toLowerCase();
  if (!type) return true;
  return type === 'text/html' || type === 'application/xhtml+xml' || type === 'text/plain';
}

async function readBoundedBody(res, maxBytes) {
  const declared = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    const err = new Error('oversized');
    throw err;
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error('oversized');
    return text;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
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

async function fetchPublicDocument(startHref, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const lookup = deps.lookup || dns.lookup;
  const timeoutMs = deps.timeoutMs || PUBLIC_CHECK_LIMITS.timeoutMs;
  let current = startHref;
  const seen = new Set();

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'Accept-Language': 'ja,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; AgentReadinessCheck/1.0; +https://readiness.coaretail.com)',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    const status = res.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = res.headers.get('location');
      if (!location) throw new Error('unreachable');
      current = new URL(location, current).toString();
      if (hop === PUBLIC_CHECK_LIMITS.maxRedirects) throw new Error('too_many_redirects');
      continue;
    }
    if (!res.ok) throw new Error('unreachable');
    if (!isHtmlContentType(res.headers.get('content-type'))) throw new Error('non_html');
    const html = await readBoundedBody(res, PUBLIC_CHECK_LIMITS.maxBytes);
    const trimmed = html.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('%PDF')) {
      throw new Error('non_html');
    }
    return { html, finalHref: current };
  }
  throw new Error('too_many_redirects');
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

function publicView(result) {
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
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

async function runPublicCheck(input = {}, deps = {}) {
  const target = resolvePublicCheckTarget(input.url || input.domain || input);
  if (!target.valid) {
    return { ok: false, error: 'invalid_url', status: 400, writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 } };
  }
  const fetchHost = target.fetchHostname || target.host;
  const hrefs = [target.href];
  if (!fetchHost.startsWith('www.') && fetchHost === target.host) {
    hrefs.push(`https://www.${target.host}/`);
  }

  let lastError;
  for (const href of hrefs) {
    try {
      const document = await fetchPublicDocument(href, deps);
      const signals = extractHtmlSignals(document.html);
      const findings = buildFindings(signals);
      return {
        ok: true,
        host: target.host,
        findings,
        resultCategory: resultCategory(findings),
        status: 200,
        writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 },
      };
    } catch (error) {
      lastError = error;
    }
  }
  const errorCode = classifyFetchFailure(lastError);
  const status = errorCode === 'invalid_url' ? 400 : errorCode === 'non_html' ? 422 : 502;
  return {
    ok: false,
    error: errorCode,
    status,
    writes: { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 },
  };
}

export {
  PUBLIC_CHECK_LIMITS,
  FINDING_CODES,
  NEXT_STEPS,
  isBlockedIp,
  resolvePublicCheckTarget,
  assertPublicHostname,
  extractHtmlSignals,
  buildFindings,
  resultCategory,
  publicView,
  assertNoPaidPayload,
  runPublicCheck,
  fetchPublicDocument,
  homepageLocalDestination,
};
