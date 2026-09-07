import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConversionRepository, CONVERSION_TYPES } from '../lib/funnel/conversions.mjs';
import { simulatePhase9Journey } from '../lib/funnel/phase9e-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const names = (journey) => journey.events.map((event) => event.event);

test('homepage Check journeys measure result and preserve neutral commercial choices', () => {
  const report = simulatePhase9Journey({ nextStep: 'REPORT' });
  const local = simulatePhase9Journey({ nextStep: 'LOCAL' });
  const learn = simulatePhase9Journey({ nextStep: 'LEARN' });
  assert.ok(names(report).includes('check_start') && names(report).includes('check_result'));
  assert.equal(report.conversions.length, 0);
  assert.equal(local.events.at(-1).ctaType, 'LOCAL');
  assert.equal(learn.events.at(-1).ctaType, 'LEARN');
});

test('Insight Check carries article and editorial intent into Report attribution', () => {
  const journey = simulatePhase9Journey({ sourceSurface: 'insight', insightSlug: 'problem-article', editorialIntent: 'PROBLEM_AWARE', verifiedPurchase: true });
  const purchase = journey.conversions[0];
  assert.equal(purchase.conversionType, CONVERSION_TYPES.REPORT_PURCHASE);
  assert.equal(purchase.value, 29800);
  assert.equal(purchase.currency, 'JPY');
  assert.equal(purchase.insightSlug, 'problem-article');
  assert.equal(purchase.editorialIntent, 'PROBLEM_AWARE');
  assert.equal(purchase.firstTouch.insightSlug, 'problem-article');
  assert.equal(purchase.lastTouch.ctaType, 'REPORT');
});

test('Evidence and local-focused Insight journeys use the intended CTA boundaries', () => {
  const evidence = simulatePhase9Journey({ sourceSurface: 'insight', insightSlug: 'evidence-article', editorialIntent: 'EVIDENCE', nextStep: 'REPORT' });
  const local = simulatePhase9Journey({ sourceSurface: 'insight', insightSlug: 'local-problem', editorialIntent: 'PROBLEM_AWARE', nextStep: 'LOCAL' });
  assert.ok(names(evidence).includes('report_checkout_start'));
  assert.equal(evidence.conversions.length, 0);
  assert.equal(local.events.at(-1).ctaType, 'LOCAL');
  assert.equal(local.attribution.editorialIntent, 'PROBLEM_AWARE');
});

test('verified purchase and qualification journey separates revenue from consultation', () => {
  const high = simulatePhase9Journey({ verifiedPurchase: true, qualificationBand: 'HIGH' });
  const low = simulatePhase9Journey({ verifiedPurchase: true, qualificationBand: 'LOW' });
  assert.equal(high.conversions.length, 1);
  assert.ok(names(high).includes('partner_qualification_complete'));
  assert.ok(names(high).includes('partner_consult_cta_click'));
  assert.ok(names(low).includes('partner_qualification_complete'));
  assert.ok(!names(low).includes('partner_consult_cta_click'));
  assert.equal(high.conversions[0].value, 29800);
});

test('conversion repository permits one persisted purchase per Stripe session and no client asserted purchase', async () => {
  const saved = [];
  const repository = createConversionRepository({
    saveConversion: async (record, key) => { saved.push({ record, key }); return { saved: true, key }; },
    findConversion: async (key) => saved.some((item) => item.key === key),
  });
  const input = { conversionType: 'REPORT_PURCHASE', externalReference: 'cs_phase9e_same', value: 1, currency: 'USD' };
  assert.equal((await repository.saveConversion(input)).saved, true);
  assert.equal((await repository.saveConversion(input)).duplicate, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].record.value, 29800);
  assert.equal(saved[0].record.currency, 'JPY');
  assert.match(read('api/conversion.js'), /input\.conversionType === 'REPORT_PURCHASE'\s*\)\s*return send\(res, 403/);
});

test('report proof is session-deduped and analytics contain no PII fields', () => {
  const analytics = read('report/src/analytics.js');
  const tracking = read('assets/sitewide-cta-tracking.js');
  assert.match(analytics, /PROOF_IMPRESSION_KEY/);
  assert.match(analytics, /oncePerSession\(PROOF_IMPRESSION_KEY\)/);
  assert.match(analytics, /insightSlug/);
  assert.match(analytics, /editorialIntent/);
  assert.doesNotMatch(analytics, /gtag\([^\n]*email/);
  assert.doesNotMatch(tracking, /company_name|phone|email|raw_url/);
});

test('all required lightweight reporting dimensions and KPI spec exist', () => {
  const spec = read('reports/phase9e-revenue-measurement.md');
  for (const token of ['Revenue Funnel', 'Editorial Intent Performance', 'Insight Performance', 'Report Conversion', 'Local Handoff', 'Qualified Partner Funnel', 'REPORT_REVENUE', 'PROOF_TO_CHECKOUT_RATE', '7 days', '14 days']) assert.match(spec, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
