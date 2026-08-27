import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWhitepaperLead } from '../lib/funnel/lead-capture.mjs';
import { createCanonicalLeadId } from '../lib/funnel/lead-schema.mjs';
import { createConversionRepository } from '../lib/funnel/conversions.mjs';
import { isNurtureEnabled, PRODUCTION_ENV } from '../lib/funnel/production-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('canonical lead ids are application ids, not Airtable record ids', () => {
  assert.match(createCanonicalLeadId(), /^lead_[a-z0-9-]+$/i);
  const lead = buildWhitepaperLead({ company: 'Example', domain: 'example.com', email: 'a@example.com', consent: true }).lead;
  assert.match(lead.leadId, /^lead_/);
  assert.equal(lead.consentType, 'SERVICE_ONLY');
});

test('same email and domain can be upserted while domain-only merge is not encoded', () => {
  const source = read('api/_lib/airtable.js');
  assert.match(source, /メールアドレス.*URL/);
  assert.match(source, /AND\(/);
  assert.doesNotMatch(source, /domain-only|domain only/i);
});

test('first touch is preserved by the Airtable upsert adapter', () => {
  const source = read('api/_lib/airtable.js');
  assert.match(source, /delete fields\.first_touch/);
  assert.match(source, /delete fields\.created_at/);
});

test('conversion adapter deduplicates report purchases and preserves lead relation', async () => {
  const saved = [];
  const repo = createConversionRepository({
    saveConversion: async (record, key) => { saved.push({ record, key }); return { saved: true, key }; },
    findConversion: async (key) => saved.some((item) => item.key === key),
  });
  const input = { conversionType: 'REPORT_PURCHASE', externalReference: 'cs_test_8b', leadId: 'lead_test' };
  assert.equal((await repo.saveConversion(input)).saved, true);
  assert.equal((await repo.saveConversion(input)).duplicate, true);
  assert.equal(saved[0].record.leadId, 'lead_test');
});

test('missing NURTURE_ENABLED fails closed', () => {
  assert.equal(isNurtureEnabled({}), false);
  assert.equal(PRODUCTION_ENV.nurtureEnabled, 'NURTURE_ENABLED');
});

test('production conversion API does not accept client asserted report revenue', () => {
  const source = read('api/conversion.js');
  assert.match(source, /report_purchase_requires_server_verification/);
  assert.match(source, /CONVERSION_PERSISTENCE_ENABLED/);
});

test('qualification persists canonical lead id separately from storage record id', () => {
  const source = read('assets/partner-qualification.js');
  const api = read('api/partner-qualification.js');
  assert.match(source, /ari_lead_id/);
  assert.match(source, /leadRecordId/);
  assert.match(api, /lead_id: qualification\.leadId/);
});
