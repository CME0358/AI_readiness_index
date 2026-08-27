import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CTA_TYPES,
  createCtaMetadata,
  mapExistingCtaLabel,
  mapPreviewClassification,
} from '../lib/funnel/cta.mjs';
import { classifyLead } from '../lib/funnel/classification.mjs';
import { createLead, validateLead } from '../lib/funnel/lead-schema.mjs';
import { DIRECT_BUYER_TYPES, PARTNER_TYPES, SEGMENTS } from '../lib/funnel/segments.mjs';
import { createAttributionStore, parseAttribution } from '../lib/funnel/attribution.mjs';
import { createEventPayload, createEventTracker, FUNNEL_EVENTS } from '../lib/funnel/events.mjs';
import { createLeadRepository } from '../lib/funnel/lead-repository.mjs';

test('segment canon exposes buyer, partner, and unknown', () => {
  assert.equal(SEGMENTS.DIRECT_BUYER, 'DIRECT_BUYER');
  assert.equal(SEGMENTS.AGENT_PARTNER, 'AGENT_PARTNER');
  assert.equal(SEGMENTS.UNKNOWN, 'UNKNOWN');
});

test('Agency industry classifies as Agent Partner / Agency', () => {
  const result = classifyLead({ industry: 'SEO / GEO Agency' });
  assert.equal(result.segment, SEGMENTS.AGENT_PARTNER);
  assert.equal(result.partnerType, PARTNER_TYPES.AGENCY);
});

test('SaaS industry classifies as Agent Partner / SaaS', () => {
  const result = classifyLead({ industry: 'Reservation SaaS' });
  assert.equal(result.segment, SEGMENTS.AGENT_PARTNER);
  assert.equal(result.partnerType, PARTNER_TYPES.SAAS);
});

test('Dental industry classifies as Direct Buyer / Dental', () => {
  const result = classifyLead({ industry: 'Dental' });
  assert.equal(result.segment, SEGMENTS.DIRECT_BUYER);
  assert.equal(result.directBuyerType, DIRECT_BUYER_TYPES.DENTAL);
});

test('unknown or ambiguous industry remains unknown', () => {
  assert.equal(classifyLead({ industry: 'Something else' }).segment, SEGMENTS.UNKNOWN);
  assert.equal(classifyLead({ industry: 'AI company for dental clinics' }).segment, SEGMENTS.UNKNOWN);
});

test('explicit Preview strategy has classification priority', () => {
  const result = classifyLead({ previewStrategy: 'AGENCY_PARTNER_V1', industry: 'Dental' });
  assert.equal(result.segment, SEGMENTS.AGENT_PARTNER);
  assert.equal(result.partnerType, PARTNER_TYPES.AGENCY);
  assert.equal(result.source, 'PREVIEW_STRATEGY');
});

test('existing Preview strategies map without changing their contract', () => {
  assert.deepEqual(mapPreviewClassification('AGENCY_PARTNER_V1'), {
    segment: SEGMENTS.AGENT_PARTNER,
    partnerType: PARTNER_TYPES.AGENCY,
    directBuyerType: null,
  });
  assert.deepEqual(mapPreviewClassification('DIRECT_BUYER'), {
    segment: SEGMENTS.DIRECT_BUYER,
    partnerType: null,
    directBuyerType: DIRECT_BUYER_TYPES.UNKNOWN,
  });
});

test('existing CTA labels map to canonical types', () => {
  assert.equal(mapExistingCtaLabel('Frameworkを見る'), CTA_TYPES.LEARN);
  assert.equal(mapExistingCtaLabel('診断を申し込む'), CTA_TYPES.REPORT);
  assert.equal(mapExistingCtaLabel('Advisoryについて相談する'), CTA_TYPES.PARTNER);
  assert.equal(mapExistingCtaLabel('not a CTA'), null);
});

test('CTA metadata validates canonical type and preserves supplied label', () => {
  const cta = createCtaMetadata({
    id: 'homepage_primary_report',
    type: CTA_TYPES.REPORT,
    label: '診断を申し込む',
    destination: '/report/',
    placement: 'homepage_hero',
  });
  assert.equal(cta.type, CTA_TYPES.REPORT);
  assert.equal(cta.label, '診断を申し込む');
  assert.equal(createCtaMetadata({ id: 'bad', type: 'UNKNOWN', destination: '/' }), null);
});

test('lead schema includes optional role and canonical unknown defaults', () => {
  const lead = createLead({ company: 'Example', email: 'person@example.test' });
  assert.equal(lead.role, '');
  assert.equal(lead.segment, SEGMENTS.UNKNOWN);
  assert.equal(lead.partnerType, PARTNER_TYPES.UNKNOWN);
  assert.equal(lead.directBuyerType, DIRECT_BUYER_TYPES.UNKNOWN);
  assert.equal(lead.schemaVersion, '1');
  assert.equal(validateLead(lead).valid, true);
});

test('attribution parses UTM, landing page, and referrer safely', () => {
  const attribution = parseAttribution('?utm_source=google&utm_campaign=ari', {
    landingPage: '/research/',
    referrer: 'https://example.test/',
    now: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(attribution.source, 'google');
  assert.equal(attribution.campaign, 'ari');
  assert.equal(attribution.landingPage, '/research/');
  assert.equal(attribution.referrer, 'https://example.test/');
});

test('attribution store preserves first touch and updates last touch', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const store = createAttributionStore(storage);
  const first = parseAttribution('?utm_source=google');
  const last = parseAttribution('?utm_source=referral');
  store.setFirstTouch(first);
  store.setFirstTouch(last);
  store.setLastTouch(first);
  store.setLastTouch(last);
  assert.equal(store.getAttribution().firstTouch.source, 'google');
  assert.equal(store.getAttribution().lastTouch.source, 'referral');
});

test('canonical event payload excludes PII', () => {
  const payload = createEventPayload(FUNNEL_EVENTS.LEAD_CREATED, {
    page: '/report/', email: 'person@example.test', company: 'Example', ctaType: 'REPORT', source: 'google',
  });
  assert.equal(payload.event, 'lead_created');
  assert.equal(payload.ctaType, 'REPORT');
  assert.equal('email' in payload, false);
  assert.equal('company' in payload, false);
});

test('legacy event names map to canonical events and tracker sends only safe payload', () => {
  const sent = [];
  const track = createEventTracker((payload) => sent.push(payload));
  track('preview_visit', { page: '/', email: 'blocked@example.test' });
  assert.equal(sent[0].event, 'landing_view');
  assert.equal('email' in sent[0], false);
});

test('LeadRepository keeps Airtable or future persistence behind an adapter', async () => {
  const calls = [];
  const repository = createLeadRepository({
    saveLead: async (lead) => calls.push(['save', lead]),
    updateLead: async (id, patch) => calls.push(['update', id, patch]),
  });
  await repository.saveLead({ leadId: null });
  await repository.updateLead('lead-1', { role: 'CEO' });
  assert.deepEqual(calls.map(([kind]) => kind), ['save', 'update']);
});
