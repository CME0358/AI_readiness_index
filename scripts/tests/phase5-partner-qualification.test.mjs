import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreQualification, validateQualification } from '../lib/funnel/qualification.mjs';
import { createEventPayload, FUNNEL_EVENTS } from '../lib/funnel/events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('qualification scoring is deterministic and centralised', () => {
  assert.deepEqual(scoreQualification({ purpose: 'CLIENT_SERVICE', scope: 'MULTIPLE_CLIENTS', timeline: 'IMMEDIATE' }), { score: 9, band: 'HIGH', recommendedAction: 'CONSULT' });
  assert.deepEqual(scoreQualification({ purpose: 'OWN_COMPANY', scope: 'SINGLE_COMPANY', timeline: 'WITHIN_6_MONTHS' }), { score: 4, band: 'MEDIUM', recommendedAction: 'CONSULT' });
  assert.deepEqual(scoreQualification({ purpose: 'RESEARCH', scope: 'UNDECIDED', timeline: 'FUTURE' }), { score: 0, band: 'LOW', recommendedAction: 'LEARN' });
});

test('qualification requires only the three canonical answers and bounds note', () => {
  assert.equal(validateQualification({ purpose: 'CLIENT_SERVICE', scope: 'MULTIPLE_CLIENTS', timeline: 'IMMEDIATE' }).valid, true);
  assert.equal(validateQualification({ purpose: 'CLIENT_SERVICE', scope: 'MULTIPLE_CLIENTS' }).valid, false);
  assert.equal(validateQualification({ purpose: 'CLIENT_SERVICE', scope: 'MULTIPLE_CLIENTS', timeline: 'IMMEDIATE', note: 'x'.repeat(2001) }).valid, false);
});

test('qualification analytics allowlist excludes PII and free text', () => {
  const payload = createEventPayload(FUNNEL_EVENTS.PARTNER_QUALIFICATION_COMPLETE, { purpose: 'CLIENT_SERVICE', scope: 'MULTIPLE_CLIENTS', timeline: 'IMMEDIATE', qualificationBand: 'HIGH', recommendedAction: 'CONSULT', email: 'a@example.com', company: 'Example', note: 'private' });
  assert.equal(payload.purpose, 'CLIENT_SERVICE');
  assert.equal(payload.email, undefined);
  assert.equal(payload.company, undefined);
  assert.equal(payload.note, undefined);
});

test('improve qualification is verified-only and preserves Advisory contract', () => {
  const page = read('improve.html');
  const script = read('assets/partner-qualification.js');
  const api = read('api/partner-qualification.js');
  assert.match(page, /data-partner-qualification/);
  assert.match(page, /¥198,000/);
  assert.match(page, /readiness\/mtgschedule/);
  assert.match(script, /purchase\.verified !== true/);
  assert.match(script, /company_report_bundle/);
  assert.match(api, /resolveCompanyReportProductFromStripeSession/);
  assert.match(api, /verification_unconfigured/);
  assert.match(read('api/whitepaper-lead.js'), /storageRecordId/);
  assert.match(read('assets/whitepaper-lead-capture.js'), /ari_lead_record_id/);
});

test('qualification failure does not revoke or overwrite report entitlement', () => {
  const script = read('assets/partner-qualification.js');
  assert.doesNotMatch(script, /ari_purchase_state.*removeItem/);
  assert.doesNotMatch(script, /entitlements\s*=\s*\{/);
});

test('Direct Buyer is not auto-routed into Partner Qualification', () => {
  const script = read('assets/partner-qualification.js');
  assert.doesNotMatch(script, /DIRECT_BUYER|localgeo/);
  assert.doesNotMatch(script, /location\.(href|assign|replace)/);
});
