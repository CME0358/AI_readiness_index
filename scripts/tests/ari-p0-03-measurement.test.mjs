import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_FUNNEL_EVENTS,
  CANONICAL_IMPLEMENTATION,
  GA4_PROPERTY,
  LEGACY_SHARED_MEASUREMENT_ID,
  DEDICATED_ARI_MEASUREMENT_ID,
  resolveServiceView,
  normalizeAwarenessChannel,
  isNonProductionHost,
  OUTBOUND_MEASUREMENT_HANDOFFS,
} from '../lib/measurement/event-dictionary.mjs';
import {
  buildAliasPayload,
  emitWithCanonicalAlias,
  createDedupeStore,
  purchaseDedupeKey,
  leadSuccessDedupeKey,
} from '../lib/measurement/canonical-emit.mjs';
import { canonicalEventName } from '../lib/funnel/events.mjs';
import { mapEventToConversion, CONVERSION_TYPES } from '../lib/funnel/conversions.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('dual-tag migration configures legacy and dedicated ARI measurement IDs only', () => {
  assert.equal(GA4_PROPERTY.migrationState, 'DUAL_TAG_VALIDATION');
  assert.equal(LEGACY_SHARED_MEASUREMENT_ID, 'G-BS30YQY1N7');
  assert.equal(DEDICATED_ARI_MEASUREMENT_ID, 'G-RGP8XZHK5V');
  assert.deepEqual([...GA4_PROPERTY.measurementIds].sort(), [LEGACY_SHARED_MEASUREMENT_ID, DEDICATED_ARI_MEASUREMENT_ID].sort());
  const ga4 = read('assets/ga4.js');
  assert.equal((ga4.match(/\.gtag\('config'/g) || []).length, 2);
  assert.match(ga4, /send_to/);
  const ids = [...new Set(ga4.match(/G-[A-Z0-9]+/g) || [])].sort();
  assert.deepEqual(ids, [DEDICATED_ARI_MEASUREMENT_ID, LEGACY_SHARED_MEASUREMENT_ID].sort());
  assert.doesNotMatch(ga4, /G-R3QVBJZ53S/);
});

test('canonical funnel taxonomy maps legacy report and lead events', () => {
  assert.equal(canonicalEventName('report_start'), CANONICAL_FUNNEL_EVENTS.DIAGNOSIS_START);
  assert.equal(canonicalEventName('report_result_view'), CANONICAL_FUNNEL_EVENTS.DIAGNOSIS_COMPLETE);
  assert.equal(canonicalEventName('lead_created'), CANONICAL_FUNNEL_EVENTS.LEAD_SUBMIT_SUCCESS);
  assert.equal(canonicalEventName('purchase_verified'), CANONICAL_FUNNEL_EVENTS.PURCHASE);
});

test('booking_confirmed remains not_connected — consult click is not booking', () => {
  assert.equal(CANONICAL_IMPLEMENTATION.booking_confirmed.status, 'not_connected');
  assert.equal(mapEventToConversion('partner_consult_cta_click', {}), CONVERSION_TYPES.CONSULT_CLICK);
  assert.equal(mapEventToConversion('consult_booked', {}), null);
  const qualification = read('assets/partner-qualification.js');
  assert.doesNotMatch(qualification, /consult_booked/);
});

test('service_view resolves commercial surfaces only', () => {
  assert.deepEqual(resolveServiceView('/report/'), { serviceKind: 'company_report', serviceId: 'report' });
  assert.deepEqual(resolveServiceView('/whitepaper/2026/free/'), { serviceKind: 'whitepaper', serviceId: 'whitepaper' });
  assert.equal(resolveServiceView('/insights/foo/'), null);
  const ga4 = read('assets/ga4.js');
  assert.match(ga4, /service_view/);
  assert.match(ga4, /company_report/);
});

test('canonical alias dual-fire excludes unverified purchases and PII', () => {
  const sent = [];
  const send = (name, params) => sent.push({ name, params });
  emitWithCanonicalAlias(send, 'purchase_verified', { verified: false, product_id: 'company_report_bundle', email: 'x@y.z' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].name, 'purchase_verified');
  emitWithCanonicalAlias(send, 'purchase_verified', { verified: true, product_id: 'company_report_bundle' });
  assert.deepEqual(sent.slice(-2).map((item) => item.name), ['purchase_verified', 'purchase']);
  assert.equal(sent.at(-1).params.email, undefined);
});

test('purchase and lead success dedupe keys prevent reload double count', () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) };
  const dedupe = createDedupeStore(storage);
  const key = purchaseDedupeKey('cs_test_abc');
  assert.equal(dedupe.once(key), true);
  assert.equal(dedupe.once(key), false);
  const leadKey = leadSuccessDedupeKey('lead_123');
  assert.equal(dedupe.once(leadKey), true);
  assert.equal(dedupe.once(leadKey), false);
  const analytics = read('report/src/analytics.js');
  assert.match(analytics, /purchaseDedupeKey/);
});

test('awareness channel is optional, normalized, and separate from UTM', () => {
  assert.equal(normalizeAwarenessChannel('chatgpt'), 'CHATGPT');
  assert.equal(normalizeAwarenessChannel(''), '');
  assert.equal(normalizeAwarenessChannel('invalid'), 'OTHER');
  const html = read('whitepaper/2026/free/index.html');
  assert.match(html, /name="awarenessChannel"/);
  const capture = read('assets/whitepaper-lead-capture.js');
  assert.match(capture, /awareness_channel_self_reported/);
  const schema = read('scripts/lib/funnel/lead-schema.mjs');
  assert.match(schema, /awarenessChannelSelfReported/);
});

test('test traffic separation uses hostname and ari_debug without inferring AI direct', () => {
  assert.equal(isNonProductionHost('localhost'), true);
  assert.equal(isNonProductionHost('readiness.coaretail.com'), false);
  const ga4 = read('assets/ga4.js');
  assert.match(ga4, /traffic_type/);
  assert.match(ga4, /ari_debug/);
  assert.doesNotMatch(ga4, /utm_source.*chatgpt/i);
});

test('localgeo handoff uses outbound UTM without GA linker', () => {
  assert.equal(OUTBOUND_MEASUREMENT_HANDOFFS.localgeo.gaLinker, false);
  assert.match(read('report/index.html'), /localgeo\.coaretail\.com\/\?utm_source=ari_report/);
  const ga4 = read('assets/ga4.js');
  assert.doesNotMatch(ga4, /linker/);
});

test('report SPA inherits sitewide ga4 and purchase_verified uses central gtag pipeline', () => {
  assert.match(read('report/index.html'), /<script src="\/assets\/ga4\.js" async><\/script>/);
  const reportAnalytics = read('report/src/analytics.js');
  assert.doesNotMatch(reportAnalytics, /G-[A-Z0-9]+/);
  assert.match(reportAnalytics, /window\.gtag\('event'/);
  assert.match(reportAnalytics, /purchase_verified/);
  assert.match(reportAnalytics, /ari_attribution_v1/);
});

test('lead_submit_success maps to LEAD_CREATED conversion only after server success path', () => {
  assert.equal(mapEventToConversion('lead_submit_success', {}), CONVERSION_TYPES.LEAD_CREATED);
  const capture = read('assets/whitepaper-lead-capture.js');
  assert.match(capture, /if \(!result\.ok\)/);
  assert.match(capture, /throw new Error/);
  assert.match(capture, /track\('lead_created'/);
  const submitBlock = capture.slice(capture.indexOf("form.addEventListener('submit'"));
  const successMarker = submitBlock.indexOf('if (typeof ux.clearDraft');
  assert.ok(successMarker > 0, 'success path should clear draft before lead_created');
  assert.doesNotMatch(submitBlock.slice(0, successMarker), /lead_created/);
});
