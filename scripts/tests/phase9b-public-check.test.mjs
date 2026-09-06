import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import handler from '../../api/public-check.js';
import { createEventPayload, FUNNEL_EVENTS } from '../lib/funnel/events.mjs';
import { normalizeDomain } from '../lib/funnel/lead-capture.mjs';
import { resolveLeadRoute } from '../lib/funnel/routing.mjs';
import { SEGMENTS } from '../lib/funnel/segments.mjs';
import {
  NEXT_STEPS,
  assertNoPaidPayload,
  extractHtmlSignals,
  buildFindings,
  isBlockedIp,
  publicView,
  resolvePublicCheckTarget,
  runPublicCheck,
} from '../lib/funnel/public-check.mjs';
import { shouldRejectPaidAnalysis } from '../lib/product-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const PUBLIC_A = [{ address: '93.184.216.34', family: 4 }];

function htmlResponse(html, headers = { 'content-type': 'text/html' }) {
  return {
    ok: true,
    status: 200,
    headers: { get: (key) => headers[key] || headers[key.toLowerCase()] || null },
    text: async () => html,
  };
}

function lookupPublic() {
  return async () => PUBLIC_A;
}

test('valid public HTTPS domain is accepted as a check target', () => {
  const target = resolvePublicCheckTarget('https://www.example.com/path');
  assert.equal(target.valid, true);
  assert.equal(target.host, 'example.com');
  assert.equal(target.href, 'https://example.com/');
});

test('invalid URL is rejected', async () => {
  assert.equal(resolvePublicCheckTarget('not-a-domain').valid, false);
  assert.equal((await runPublicCheck({ url: 'not a url' })).error, 'invalid_url');
});

test('localhost is rejected', async () => {
  assert.equal(normalizeDomain('http://localhost').valid, false);
  assert.equal((await runPublicCheck({ url: 'http://localhost' })).ok, false);
});

test('127.0.0.1 is rejected', async () => {
  assert.equal(normalizeDomain('http://127.0.0.1').valid, false);
  assert.equal((await runPublicCheck({ url: 'http://127.0.0.1' })).ok, false);
});

test('private IPv4 is rejected', () => {
  assert.equal(isBlockedIp('10.0.0.8'), true);
  assert.equal(isBlockedIp('192.168.1.1'), true);
  assert.equal(isBlockedIp('172.16.5.4'), true);
  assert.equal(normalizeDomain('http://192.168.0.1').valid, false);
});

test('private IPv6 / loopback is rejected', () => {
  assert.equal(isBlockedIp('::1'), true);
  assert.equal(isBlockedIp('fe80::1'), true);
  assert.equal(isBlockedIp('fd00::1'), true);
  assert.equal(normalizeDomain('https://[::1]/').valid, false);
});

test('redirect to private target is rejected', async () => {
  const result = await runPublicCheck({ url: 'https://example.com' }, {
    lookup: lookupPublic(),
    fetchImpl: async () => ({
      ok: false,
      status: 302,
      headers: { get: (key) => (key.toLowerCase() === 'location' ? 'https://127.0.0.1/' : null) },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'blocked_target');
});

test('timeout is handled without throwing', async () => {
  const result = await runPublicCheck({ url: 'https://example.com' }, {
    lookup: lookupPublic(),
    timeoutMs: 20,
    fetchImpl: (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const error = new Error('timeout');
        error.name = 'TimeoutError';
        reject(error);
      });
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'timeout');
});

test('non-HTML responses are handled', async () => {
  const result = await runPublicCheck({ url: 'https://example.com' }, {
    lookup: lookupPublic(),
    fetchImpl: async () => htmlResponse('{"ok":true}', { 'content-type': 'application/json' }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'non_html');
});

test('successful check returns at most two observations and no paid fields', async () => {
  const html = '<html><head><meta property="og:title" content="Shop"></head><body>welcome</body></html>';
  const result = await runPublicCheck({ url: 'https://example.com' }, {
    lookup: lookupPublic(),
    fetchImpl: async () => htmlResponse(html),
  });
  assert.equal(result.ok, true);
  assert.ok(result.findings.length <= 2);
  const view = publicView(result);
  assert.equal(assertNoPaidPayload(view), true);
  assert.equal(JSON.stringify(view).includes('overallScore'), false);
  assert.equal(JSON.stringify(view).includes('scoreBreakdown'), false);
  assert.equal(JSON.stringify(view).includes('aiRecognition'), false);
  assert.equal(JSON.stringify(view).includes('roadmap'), false);
});

test('result causes no Airtable, Leads, Inbound_Leads, or conversion writes', async () => {
  const result = await runPublicCheck({ url: 'https://example.com' }, {
    lookup: lookupPublic(),
    fetchImpl: async () => htmlResponse('<html><body>ok</body></html>'),
  });
  assert.deepEqual(result.writes, { airtable: 0, leads: 0, inboundLeads: 0, conversions: 0 });
  const api = read('api/public-check.js');
  const lib = read('scripts/lib/funnel/public-check.mjs');
  for (const source of [api, lib]) {
    assert.doesNotMatch(source, /Inbound_Leads/);
    assert.doesNotMatch(source, /AIRTABLE_TABLE_NAME/);
    assert.doesNotMatch(source, /saveToAirtable/);
    assert.doesNotMatch(source, /api\/analyze/);
    assert.doesNotMatch(source, /buildReport/);
    assert.doesNotMatch(source, /OPENAI_API_KEY/);
  }
});

test('CHECK CTA attributes, LOCAL destination, and REPORT destination are correct', () => {
  const html = read('index.html');
  assert.match(html, /id="company-check"/);
  assert.match(html, /data-cta-id="homepage_check_submit"[\s\S]*data-cta-type="CHECK"/);
  assert.match(html, /data-cta-id="homepage_check_report"[\s\S]*data-cta-type="REPORT"/);
  assert.match(html, /href="\/report\/"[^>]*data-cta-type="REPORT"|data-cta-type="REPORT"[^>]*href="\/report\/"/);
  assert.match(html, /localgeo\.coaretail\.com/);
  assert.match(html, /data-cta-id="homepage_check_local"[^>]*data-cta-type="LOCAL"|data-cta-type="LOCAL"[^>]*data-cta-id="homepage_check_local"/);
  assert.equal(new URL(NEXT_STEPS.local.href).origin, 'https://localgeo.coaretail.com');
  assert.equal(NEXT_STEPS.report.href, '/report/');
  assert.equal(NEXT_STEPS.learn.href, '/whitepaper/2026/free/');
  assert.match(html, /月額60,000円/);
  assert.doesNotMatch(html.slice(html.indexOf('id="company-check"'), html.indexOf('id="about"')), /月額 ¥198,000/);
});

test('analytics payload contains no raw URL, domain, or PII', () => {
  const js = read('assets/homepage-public-check.js');
  assert.match(js, /check_impression/);
  assert.match(js, /check_start/);
  assert.match(js, /check_result/);
  assert.match(js, /PII/);
  const payload = createEventPayload(FUNNEL_EVENTS.CHECK_RESULT, {
    page: '/',
    ctaType: 'CHECK',
    resultCategory: 'gap',
    url: 'https://secret.example',
    domain: 'secret.example',
    email: 'person@secret.example',
    company: 'Secret Co',
  });
  assert.equal(payload.event, 'check_result');
  assert.equal(payload.resultCategory, 'gap');
  assert.equal(payload.url, undefined);
  assert.equal(payload.domain, undefined);
  assert.equal(payload.email, undefined);
  assert.equal(payload.company, undefined);
});

test('existing funnel routing regression remains PASS', () => {
  assert.equal(resolveLeadRoute({ segment: SEGMENTS.DIRECT_BUYER, confidence: 0.9 }).action, 'LOCAL');
  assert.equal(resolveLeadRoute({ segment: SEGMENTS.AGENT_PARTNER, confidence: 0.9 }).action, 'REPORT');
  assert.equal(resolveLeadRoute({ segment: SEGMENTS.UNKNOWN, confidence: 0.9 }).action, 'LEARN');
  assert.equal(resolveLeadRoute({ segment: SEGMENTS.DIRECT_BUYER, confidence: 0.2 }).action, 'LEARN');
});

test('Stripe entitlement regression remains PASS', () => {
  assert.equal(shouldRejectPaidAnalysis({ paid: true, hasAnyKey: false, validAICount: 0 }).reject, true);
  assert.equal(shouldRejectPaidAnalysis({ paid: false, hasAnyKey: false, validAICount: 0 }).reject, false);
});

test('HTML observations prefer gaps and stay qualitative', () => {
  const signals = extractHtmlSignals('<html><body>hello</body></html>');
  const findings = buildFindings(signals);
  assert.ok(findings.length <= 2);
  assert.ok(findings.every((item) => /可能性|状態です|確認できます|手がかり/.test(item.copy)));
  assert.equal(findings.some((item) => /\d{2}/.test(item.copy) && item.copy.includes('点')), false);
});

test('DNS to private address is rejected before fetch', async () => {
  let fetched = false;
  const result = await runPublicCheck({ url: 'https://example.com' }, {
    lookup: async () => [{ address: '10.1.2.3', family: 4 }],
    fetchImpl: async () => {
      fetched = true;
      return htmlResponse('<html></html>');
    },
  });
  assert.equal(fetched, false);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'blocked_target');
});

test('public-check HTTP handler does not write leads', async () => {
  const req = {
    method: 'POST',
    body: JSON.stringify({ url: 'not-a-domain' }),
  };
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = body; },
  };
  await handler(req, res);
  const json = JSON.parse(res.body);
  assert.equal(json.ok, false);
  assert.equal(json.leadId, undefined);
  assert.equal(assertNoPaidPayload(json), true);
});

test('homepage keeps Hero, About, Whitepaper, Report, and Framework', () => {
  const html = read('index.html');
  const checkAt = html.indexOf('id="company-check"');
  const aboutAt = html.indexOf('id="about"');
  const heroActionsAt = html.indexOf('hero-actions');
  assert.ok(checkAt > heroActionsAt);
  assert.ok(aboutAt > checkAt);
  assert.match(html, /id="ari-fv-animation"/);
  assert.match(html, /homepage_primary_whitepaper/);
  assert.match(html, /homepage_report/);
  assert.match(html, /homepage_framework/);
  assert.match(html, /Research Hubとは/);
});
