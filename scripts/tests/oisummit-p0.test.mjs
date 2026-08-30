#!/usr/bin/env node
/**
 * OISUMMIT P0 tests — routing, scenarios, attribution, QR destinations
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

const PAGES = [
  'oisummit/index.html',
  'oisummit/enterprise/index.html',
  'oisummit/public/index.html',
  'oisummit/tech/index.html',
];

test('OISUMMIT pages exist with required assets', () => {
  PAGES.forEach((rel) => {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(html, /\/assets\/ga4\.js/);
    assert.match(html, /\/assets\/oisummit-analytics\.js/);
    assert.match(html, /data-agent-demo|data-demo-scenario/);
    assert.match(html, /readiness\.coaretail\.com\/oisummit/);
  });
});

test('All OISUMMIT pages do not expose ABIS brand', () => {
  PAGES.forEach((rel) => {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.doesNotMatch(html, /Agent Business Interaction Standard/i, rel);
    assert.doesNotMatch(html, /\bABIS\b/, rel);
  });
});

test('Tech LP uses Agent Execution messaging', () => {
  const html = fs.readFileSync(path.join(ROOT, 'oisummit/tech/index.html'), 'utf8');
  assert.match(html, /Agent Execution/);
  assert.match(html, /システム上の成功/);
  assert.match(html, /業務上の成功/);
});

test('Tech demo scenario uses Japanese labels', () => {
  const code = fs.readFileSync(path.join(ROOT, 'assets/agent-demo-scenarios.js'), 'utf8');
  assert.match(code, /希望条件と不一致/);
  assert.match(code, /システム処理/);
  assert.match(code, /API 200 OK/);
  assert.match(code, /label: '依頼'/);
  assert.doesNotMatch(code, /OUTCOME MISMATCH/);
});

test('Agent demo scenarios cover enterprise public tech', () => {
  const code = fs.readFileSync(path.join(ROOT, 'assets/agent-demo-scenarios.js'), 'utf8');
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function('window', code.replace('typeof window !== \'undefined\' ? window : globalThis', 'window'))(sandbox.window);
  const scenarios = sandbox.window.AGENT_DEMO_SCENARIOS;
  assert.ok(scenarios.enterprise);
  assert.ok(scenarios.public);
  assert.ok(scenarios.tech);
  assert.equal(scenarios.enterprise.duration, 10);
  assert.ok(scenarios.tech.steps.some((s) => s.highlight));
});

test('Homepage FV unchanged — still uses ARI_FV_MASTER mount', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /id="ari-fv-animation"/);
  assert.doesNotMatch(home, /data-demo-scenario/);
  assert.match(home, /AIに「見つかる」だけでなく/);
});

test('OISUMMIT lead capture validates segment and excludes honeypot', async () => {
  const { normalizeOisummitLeadForm, INTEREST_BY_SEGMENT, buildOisummitLead } = await import('../lib/funnel/oisummit-lead-capture.mjs');
  const { fieldsForLead } = await import('../../api/_lib/airtable.cjs');
  assert.ok(INTEREST_BY_SEGMENT.enterprise.length >= 4);
  const bad = normalizeOisummitLeadForm({ segment: 'enterprise', website: 'spam' });
  assert.equal(bad.valid, false);
  const ok = normalizeOisummitLeadForm({
    segment: 'enterprise',
    company: 'Demo Corp',
    name: 'Tester',
    email: 'test@example.co.jp',
    interest: INTEREST_BY_SEGMENT.enterprise[0],
    consent: true,
  });
  assert.equal(ok.valid, true);
  const built = buildOisummitLead({
    segment: 'enterprise',
    company: 'Demo Corp',
    name: 'Tester',
    email: 'test@example.co.jp',
    interest: INTEREST_BY_SEGMENT.enterprise[0],
    consent: true,
  });
  assert.match(fieldsForLead(built.lead, 'Inbound_Leads').industry, /name:Tester/);
});

test('OISUMMIT QR manifest destinations encode canonical UTMs', () => {
  const manifestPath = path.join(ROOT, 'public', 'qr', 'oisummit-qr-manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'run scripts/generate-oisummit-qr.mjs first');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.length, 4);
  manifest.forEach((entry) => {
    const url = new URL(entry.url);
    assert.equal(url.hostname, 'readiness.coaretail.com');
    assert.equal(url.searchParams.get('utm_source'), 'oisummit');
    assert.equal(url.searchParams.get('utm_medium'), 'qr');
    assert.equal(url.searchParams.get('utm_campaign'), 'oisummit2026');
    assert.match(entry.url, /utm_content=(general|enterprise|public|tech)/);
  });
});

test('build:all includes oisummit copy step', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['build:all'], /public_build\/oisummit/);
  assert.match(pkg.scripts['build:all'], /cp -r oisummit/);
});

test('OISUMMIT analytics and lead capture exclude PII keys', () => {
  const analytics = fs.readFileSync(path.join(ROOT, 'assets/oisummit-analytics.js'), 'utf8');
  const lead = fs.readFileSync(path.join(ROOT, 'assets/oisummit-lead-capture.js'), 'utf8');
  assert.match(analytics, /oisummit_lp_view/);
  assert.match(lead, /oisummit_lead_submit/);
  assert.match(analytics, /\['name', 'email', 'company', 'message', 'domain'\]/);
});
