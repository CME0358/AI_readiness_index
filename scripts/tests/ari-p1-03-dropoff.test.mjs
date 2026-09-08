import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeLeadCaptureForm } from '../lib/funnel/lead-capture.mjs';
import { validateQualification } from '../lib/funnel/qualification.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('ARI-P1-03 form-ux module exposes draft, field errors, and submit busy helpers', () => {
  const ux = read('assets/form-ux.js');
  assert.match(ux, /bindDraftAutosave/);
  assert.match(ux, /mapServerFields/);
  assert.match(ux, /bindSubmitButton/);
  assert.match(ux, /aria-busy/);
  assert.doesNotMatch(ux, /email/);
});

test('ARI-P1-03 whitepaper lead keeps values on failure and maps server field errors', () => {
  const capture = read('assets/whitepaper-lead-capture.js');
  const html = read('whitepaper/2026/free/index.html');
  assert.match(html, /form-ux\.js/);
  assert.match(capture, /ari_whitepaper_lead_draft_v1/);
  assert.match(capture, /bindDraftAutosave/);
  assert.match(capture, /送信中/);
  assert.match(capture, /invalid_form/);
  assert.match(capture, /mapServerFields/);
  assert.match(capture, /入力内容は保持されています/);
  const submitBlock = capture.slice(capture.indexOf("form.addEventListener('submit'"));
  assert.doesNotMatch(submitBlock.slice(0, submitBlock.indexOf("if (!result.ok)")), /lead_created/);
  assert.match(capture, /ariMeasurement\.once\(sessionStorage/);
});

test('ARI-P1-03 partner qualification shows per-field errors and consult link on success', () => {
  const script = read('assets/partner-qualification.js');
  const improve = read('improve.html');
  assert.match(improve, /form-ux\.js/);
  assert.match(script, /mapServerFields/);
  assert.match(script, /送信中/);
  assert.match(script, /readiness\/mtgschedule/);
  assert.match(script, /入力内容は保持されています/);
  assert.doesNotMatch(script, /consult_booked/);
});

test('ARI-P1-03 homepage public check supports retry without clearing input', () => {
  const js = read('assets/homepage-public-check.js');
  const html = read('index.html');
  assert.match(html, /data-public-check-retry/);
  assert.match(html, /homepage_check_consult/);
  assert.match(html, /readiness\/mtgschedule/);
  assert.match(js, /runCheck/);
  assert.match(js, /data-public-check-retry/);
  assert.match(js, /入力内容は保持されています/);
  assert.match(html, /公開ページから読み取った手がかりであり、断定ではありません/);
  assert.doesNotMatch(js, /score/i);
});

test('ARI-P1-03 whitepaper checkout prevents double redirect and shows busy state', () => {
  const checkout = read('assets/whitepaper-checkout.js');
  const stripe = read('assets/whitepaper-stripe.js');
  assert.match(checkout, /redirecting/);
  assert.match(checkout, /Stripeに接続中/);
  assert.match(checkout, /btn\.disabled = true/);
  assert.match(stripe, /cancel_url|canceled=1/i);
  assert.match(read('whitepaper/2026/research/checkout.html'), /wp-canceled/);
});

test('ARI-P1-03 lead API field errors align with client message map', () => {
  const invalid = normalizeLeadCaptureForm({ company: '', domain: 'bad', email: 'x', consent: false });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.company);
  assert.ok(invalid.errors.domain);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.consent);
  const capture = read('assets/whitepaper-lead-capture.js');
  Object.keys(invalid.errors).forEach((field) => {
    assert.match(capture, new RegExp(field + ':'));
  });
});

test('ARI-P1-03 partner qualification API validation maps to field keys', () => {
  const result = validateQualification({ purpose: 'INVALID', scope: 'MULTIPLE_CLIENTS', timeline: 'IMMEDIATE' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.purpose);
  const script = read('assets/partner-qualification.js');
  assert.match(script, /invalid_qualification/);
});

test('ARI-P1-03 required fields unchanged — public check stays email-free', () => {
  const html = read('index.html');
  assert.match(html, /メールアドレスは不要です/);
  const leadHtml = read('whitepaper/2026/free/index.html');
  assert.match(leadHtml, /name="email".*required/);
  assert.match(leadHtml, /name="company".*required/);
  assert.match(leadHtml, /name="domain".*required/);
});

test('ARI-P1-03 booking_confirmed remains not_connected — outbound consult only', () => {
  const capture = read('assets/whitepaper-lead-capture.js');
  const publicCheck = read('assets/homepage-public-check.js');
  assert.doesNotMatch(capture, /booking_confirmed/);
  assert.doesNotMatch(publicCheck, /booking_confirmed/);
});
