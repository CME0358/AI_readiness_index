import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONVERSION_TYPES, createConversion, createConversionRepository, mapEventToConversion } from '../lib/funnel/conversions.mjs';
import { createEventPayload } from '../lib/funnel/events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('verified Company Report purchase maps to canonical ¥29,800 JPY conversion', () => {
  assert.equal(mapEventToConversion('purchase_verified', { verified: true, product_id: 'company_report_bundle' }), CONVERSION_TYPES.REPORT_PURCHASE);
  const conversion = createConversion({ conversionType: CONVERSION_TYPES.REPORT_PURCHASE, externalReference: 'cs_test_123', segment: 'AGENT_PARTNER' });
  assert.equal(conversion.value, 29800);
  assert.equal(conversion.currency, 'JPY');
});

test('unverified, wrong-product, and click events never become Report revenue', () => {
  assert.equal(mapEventToConversion('purchase_verified', { verified: false, product_id: 'company_report_bundle' }), null);
  assert.equal(mapEventToConversion('purchase_verified', { verified: true, product_id: 'research_edition' }), null);
  assert.equal(mapEventToConversion('partner_consult_cta_click', {}), CONVERSION_TYPES.CONSULT_CLICK);
  assert.equal(mapEventToConversion('routing_cta_click', { action: 'LOCAL' }), CONVERSION_TYPES.DIRECT_BUYER_ROUTED);
  assert.equal(mapEventToConversion('routing_cta_click', { action: 'REPORT' }), CONVERSION_TYPES.AGENT_PARTNER_ROUTED);
});

test('ConversionRepository deduplicates the same external purchase reference', async () => {
  const saved = [];
  const repository = createConversionRepository({ saveConversion: async (record, key) => { saved.push({ record, key }); return { saved: true, key }; }, findConversion: async (key) => saved.some((item) => item.key === key) });
  const first = await repository.saveConversion({ conversionType: 'REPORT_PURCHASE', externalReference: 'cs_same' });
  const second = await repository.saveConversion({ conversionType: 'REPORT_PURCHASE', externalReference: 'cs_same' });
  assert.equal(first.saved, true);
  assert.equal(second.duplicate, true);
  assert.equal(saved.length, 1);
});

test('conversion analytics payload excludes PII and preserves attribution dimensions', () => {
  const payload = createEventPayload('partner_qualification_complete', { segment: 'AGENT_PARTNER', partnerType: 'AGENCY', qualificationBand: 'HIGH', ctaId: 'routing_agent_partner_report', source: 'google', campaign: 'ari', email: 'person@example.com', company: 'Example', note: 'private' });
  assert.equal(payload.partnerType, 'AGENCY');
  assert.equal(payload.campaign, 'ari');
  assert.equal(payload.email, undefined);
  assert.equal(payload.company, undefined);
  assert.equal(payload.note, undefined);
});

test('report analytics records verified purchases without treating consultation as revenue', () => {
  const analytics = read('report/src/analytics.js');
  assert.match(analytics, /recordConversion\('REPORT_PURCHASE'/);
  assert.match(analytics, /params\.verified === true/);
  assert.match(analytics, /value: conversionType === 'REPORT_PURCHASE' \? 29800/);
  assert.doesNotMatch(analytics, /CONSULT_CLICK.*29800/);
});

test('sitewide and qualification tracking preserve attribution and exclude PII', () => {
  const sitewide = read('assets/sitewide-cta-tracking.js');
  const qualification = read('assets/partner-qualification.js');
  assert.match(sitewide, /ari_attribution_v1/);
  assert.match(sitewide, /insightSlug/);
  assert.match(qualification, /partner_qualification_complete/);
  assert.match(qualification, /partner_consult_cta_click/);
  assert.doesNotMatch(qualification, /window\.location\.(href|assign|replace)/);
});

test('consultation booking, backend opportunity, and local conversion are not inferred', () => {
  const source = read('scripts/lib/funnel/conversions.mjs');
  assert.match(source, /CONSULT_BOOKED/);
  assert.match(source, /BACKEND_OPPORTUNITY/);
  assert.match(source, /LOCAL_CONVERSION/);
  assert.doesNotMatch(source, /CONSULT_CLICK[^\n]*29800/);
});
