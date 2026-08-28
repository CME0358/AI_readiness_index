import test from 'node:test';
import assert from 'node:assert/strict';

import {
  conversionFields,
  fieldsForLead,
  findConversionByDedupeKey,
  findLeadByIdentity,
  serializeInboundQualification,
  serializeLegacyLead,
  tableFamily,
} from '../../api/_lib/airtable.cjs';

const lead = {
  leadId: 'lead-1', company: 'Example', domain: 'example.com', email: 'person@example.com', industry: 'SEO', role: 'WEB',
  segment: 'AGENT_PARTNER', partnerType: 'AGENCY', directBuyerType: 'UNKNOWN', source: 'source', medium: 'medium', campaign: 'campaign',
  landingPage: '/whitepaper/', referrer: '', ctaId: 'cta', ctaType: 'LEARN', firstTouch: { source: 'first' }, lastTouch: { source: 'last' },
  routeAction: 'REPORT', routeDestination: '/report/', routeVersion: '1', routeConfidence: 0.9, routeConfidenceBand: 'HIGH',
  consentType: 'SERVICE_ONLY', consentVersion: '1', consentedAt: '2026-01-01T00:00:00.000Z', consentSource: 'WHITEPAPER',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', schemaVersion: '1',
};

test('table families are explicit and unknown tables fail closed', () => {
  assert.equal(tableFamily('Leads'), 'legacy_leads');
  assert.equal(tableFamily('Inbound_Leads'), 'inbound_leads');
  assert.equal(tableFamily('Inbound_Leads_Staging'), 'inbound_leads');
  assert.equal(tableFamily('Inbound_Conversions'), 'inbound_conversions');
  assert.equal(tableFamily('Inbound_Conversions_Staging'), 'inbound_conversions');
  assert.equal(tableFamily('Other'), null);
  assert.equal(fieldsForLead(lead, 'Other'), null);
  assert.equal(conversionFields({ conversionType: 'DIRECT_BUYER_ROUTED' }, 'key', 'Other'), null);
});

test('legacy lead mapping remains Japanese and inbound mappings are English', () => {
  const legacy = serializeLegacyLead(lead);
  assert.deepEqual(Object.keys(legacy), ['会社名', 'URL', 'メールアドレス', '業種']);
  for (const table of ['Inbound_Leads', 'Inbound_Leads_Staging']) {
    const inbound = fieldsForLead(lead, table);
    assert.equal('company' in inbound, true);
    assert.equal('domain' in inbound, true);
    assert.equal('email' in inbound, true);
    assert.equal('lead_id' in inbound, true);
    assert.equal(Object.keys(inbound).some((key) => /会社名|メールアドレス|^URL$/.test(key)), false);
  }
});

test('both inbound conversion tables use the canonical English schema', () => {
  for (const table of ['Inbound_Conversions', 'Inbound_Conversions_Staging']) {
    const fields = conversionFields({ conversionId: 'conversion-1', leadId: 'lead-1', conversionType: 'DIRECT_BUYER_ROUTED', occurredAt: '2026-01-01T00:00:00.000Z' }, 'DIRECT_BUYER_ROUTED:lead-1', table);
    assert.equal(fields.conversion_id, 'conversion-1');
    assert.equal(fields.lead_id, 'lead-1');
    assert.equal(fields.conversion_type, 'DIRECT_BUYER_ROUTED');
    assert.equal('会社名' in fields, false);
  }
});

test('qualification patch mapping uses only fields present in inbound lead schema', () => {
  const fields = serializeInboundQualification({ leadId: 'lead-1', purpose: 'CLIENT_SERVICE', scope: 'MULTIPLE_CLIENTS', timeline: 'WITHIN_3_MONTHS', note: 'note', qualificationBand: 'HIGH', qualificationScore: 8, recommendedAction: 'CONSULT' }, 'Inbound_Leads_Staging');
  assert.equal(fields.qualification_note, 'note');
  assert.equal('qualification_created_at' in fields, false);
});

test('inbound identity and conversion dedupe lookups use English field names', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const urls = [];
  process.env.VERCEL_ENV = 'development';
  process.env.AIRTABLE_API_KEY = 'test';
  process.env.AIRTABLE_BASE_ID = 'appTest';
  process.env.INBOUND_LEADS_STAGING_TABLE_NAME = 'Inbound_Leads_Staging';
  process.env.INBOUND_CONVERSIONS_STAGING_TABLE_NAME = 'Inbound_Conversions_Staging';
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => ({ records: [] }) };
  };
  try {
    await findLeadByIdentity(lead);
    await findConversionByDedupeKey('DIRECT_BUYER_ROUTED:lead-1');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }
  assert.match(decodeURIComponent(urls[0]), /\{email\}/);
  assert.match(decodeURIComponent(urls[0]), /\{domain\}/);
  assert.match(decodeURIComponent(urls[1]), /\{dedupe_key\}/);
  assert.doesNotMatch(decodeURIComponent(urls[0]), /会社名|メールアドレス|URL/);
  assert.doesNotMatch(decodeURIComponent(urls[1]), /会社名|メールアドレス|URL/);
});
