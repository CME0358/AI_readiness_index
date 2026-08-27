import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveInboundAirtableTables } from '../../api/_lib/airtable.cjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const base = {
  AIRTABLE_TABLE_NAME: 'Leads',
  INBOUND_LEADS_TABLE_NAME: 'Inbound_Leads',
  INBOUND_CONVERSIONS_TABLE_NAME: 'Inbound_Conversions',
  INBOUND_LEADS_STAGING_TABLE_NAME: 'Inbound_Leads_Staging',
  INBOUND_CONVERSIONS_STAGING_TABLE_NAME: 'Inbound_Conversions_Staging',
};

test('production resolves only the Inbound production namespace', () => {
  assert.deepEqual(resolveInboundAirtableTables({ ...base, VERCEL_ENV: 'production' }), { environment: 'production', leadsTable: 'Inbound_Leads', conversionsTable: 'Inbound_Conversions', writeEnabled: true });
});

test('preview resolves only the Inbound staging namespace', () => {
  assert.deepEqual(resolveInboundAirtableTables({ ...base, VERCEL_ENV: 'preview' }), { environment: 'preview', leadsTable: 'Inbound_Leads_Staging', conversionsTable: 'Inbound_Conversions_Staging', writeEnabled: true });
});

test('development requires explicit staging tables', () => {
  assert.equal(resolveInboundAirtableTables({ ...base, VERCEL_ENV: 'development' }).writeEnabled, true);
  const missing = { ...base, VERCEL_ENV: 'development' };
  delete missing.INBOUND_LEADS_STAGING_TABLE_NAME;
  assert.deepEqual(resolveInboundAirtableTables(missing), { environment: 'development', leadsTable: null, conversionsTable: 'Inbound_Conversions_Staging', writeEnabled: false });
});

test('unknown and missing environments fail closed without Production fallback', () => {
  for (const env of [{ ...base, VERCEL_ENV: 'something_else' }, { ...base }]) {
    assert.deepEqual(resolveInboundAirtableTables(env), { environment: 'unknown', leadsTable: null, conversionsTable: null, writeEnabled: false });
  }
});

test('missing Inbound config never falls back to legacy Leads', () => {
  assert.equal(resolveInboundAirtableTables({ AIRTABLE_TABLE_NAME: 'Leads', VERCEL_ENV: 'production' }).leadsTable, null);
  assert.doesNotMatch(read('api/whitepaper-lead.js'), /AIRTABLE_TABLE_NAME/);
  assert.doesNotMatch(read('api/conversion.js'), /AIRTABLE_TABLE_NAME/);
  assert.doesNotMatch(read('api/partner-qualification.js'), /AIRTABLE_TABLE_NAME/);
});

test('existing diagnosis keeps the legacy ARI namespace', () => {
  assert.match(read('api/analyze.js'), /process\.env\.AIRTABLE_TABLE_NAME/);
  assert.match(read('report/.env.example'), /AIRTABLE_TABLE_NAME=Leads/);
});

test('report purchase persistence uses the same Inbound resolver', () => {
  assert.match(read('api/verify-purchase.js'), /_lib\/airtable\.cjs/);
  assert.match(read('api/_lib/airtable.cjs'), /resolveInboundAirtableTables/);
});
