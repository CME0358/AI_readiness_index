import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWhitepaperLead, normalizeDomain, normalizeEmail, normalizeLeadCaptureForm } from '../lib/funnel/lead-capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const valid = { company: 'Example Co.', domain: 'https://www.example.com/path', email: ' PERSON@Example.COM ', role: 'MARKETING', consent: true, query: '?utm_source=google&utm_campaign=whitepaper' };

test('valid Whitepaper form creates a canonical lead', () => {
  const result = buildWhitepaperLead(valid, { now: '2026-08-27T00:00:00.000Z' });
  assert.equal(result.valid, true);
  assert.equal(result.lead.company, 'Example Co.');
  assert.equal(result.lead.domain, 'example.com');
  assert.equal(result.lead.email, 'person@example.com');
  assert.equal(result.lead.ctaId, 'whitepaper_free_2026');
  assert.equal(result.lead.ctaType, 'LEARN');
  assert.equal(result.lead.source, 'google');
});

test('required company, domain, email, and consent are enforced', () => {
  for (const field of ['company', 'domain', 'email', 'consent']) {
    const input = { ...valid };
    if (field === 'consent') input[field] = false;
    else input[field] = '';
    assert.equal(normalizeLeadCaptureForm(input).valid, false, field);
  }
});

test('role is optional and unknown role is safely canonicalized', () => {
  const result = normalizeLeadCaptureForm({ ...valid, role: '' });
  assert.equal(result.valid, true);
  assert.equal(result.value.role, 'UNKNOWN');
  assert.equal(normalizeLeadCaptureForm({ ...valid, role: 'not-a-role' }).value.role, 'UNKNOWN');
});

test('domain normalization strips scheme, www, path, query, and trailing slash', () => {
  assert.deepEqual(normalizeDomain('https://www.example.com/path?q=1'), { valid: true, value: 'example.com' });
  assert.deepEqual(normalizeDomain('example.com/'), { valid: true, value: 'example.com' });
});

test('unsafe or malformed domains fail safely', () => {
  for (const domain of ['not-a-domain', 'http://localhost:3000', 'https://user:pass@example.com', 'http://127.0.0.1']) {
    assert.equal(normalizeDomain(domain).valid, false, domain);
  }
  assert.equal(normalizeDomain('https://example.com').valid, true);
});

test('email validation trims and lowercases without requiring MX checks', () => {
  assert.deepEqual(normalizeEmail('  PERSON@Example.COM '), { valid: true, value: 'person@example.com' });
  assert.equal(normalizeEmail('person@example').valid, false);
  assert.equal(normalizeEmail('person..x@example.com').valid, false);
});

test('classification and attribution attach to the lead without automatic routing', () => {
  const result = buildWhitepaperLead({ ...valid, industry: 'Dental' });
  assert.equal(result.lead.segment, 'DIRECT_BUYER');
  assert.equal(result.lead.directBuyerType, 'DENTAL');
  assert.equal(result.lead.firstTouch.source, 'google');
  assert.equal(result.lead.lastTouch.campaign, 'whitepaper');
  assert.equal(result.lead.ctaId, 'whitepaper_free_2026');
  assert.doesNotMatch(JSON.stringify(result), /localgeo\.coaretail\.com/);
});

test('duplicate submissions remain valid and do not crash', () => {
  const first = buildWhitepaperLead(valid);
  const second = buildWhitepaperLead({ ...valid, query: '?utm_source=referral' });
  assert.equal(first.valid, true);
  assert.equal(second.valid, true);
});

test('Whitepaper page keeps canonical SEO and uses lead capture asset', () => {
  const html = fs.readFileSync(path.join(ROOT, 'whitepaper/2026/free/index.html'), 'utf8');
  assert.match(html, /rel="canonical" href="https:\/\/readiness\.coaretail\.com\/whitepaper\/2026\/free\/"/);
  assert.match(html, /data-whitepaper-lead-form/);
  assert.match(html, /whitepaper-lead-capture\.js/);
  assert.match(html, /data-cta-id|whitepaper_free_2026/);
});

test('lead API persists through LeadRepository adapter and never exposes routing redirect', () => {
  const api = fs.readFileSync(path.join(ROOT, 'api/whitepaper-lead.js'), 'utf8');
  assert.match(api, /createLeadRepository/);
  assert.match(api, /repository\.saveLead/);
  assert.doesNotMatch(api, /localgeo\.coaretail\.com/);
});
