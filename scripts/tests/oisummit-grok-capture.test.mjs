#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCaptureMessage, hasCaptureIntent, formatPreview } from '../lib/oisummit/grok-parser.mjs';
import { buildCaptureFields, validateCaptureFields, writeCaptureToAirtable } from '../lib/oisummit/capture-core.mjs';
import { resolveCaptureTarget } from '../lib/oisummit/target-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOW = new Date('2026-09-10T12:00:00+09:00');

test('TEST 01 existing target BIPROGY HOT Agent Execution', () => {
  const msg = `OISUMMIT記録
BIPROGY
Agent ExecutionのBusiness Outcome Verificationに反応あり。
技術担当を含め再度話したい。
HOT。
明日メール。`;
  const parsed = parseCaptureMessage(msg, { now: NOW });
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.draft.target_id, 'biprogy');
  assert.equal(parsed.draft.target_name, 'BIPROGY');
  assert.equal(parsed.draft.result, 'HOT');
  assert.equal(parsed.draft.route, 'AGENT_EXECUTION');
  assert.equal(parsed.draft.contact_method, 'EMAIL');
  assert.equal(parsed.draft.next_action, 'MEETING');
  assert.match(parsed.draft.memo, /Business Outcome Verification/);
});

test('TEST 02 government 相模原市 MAR WARM', () => {
  const msg = `OISUMMIT記録
相模原市
MARの住民Journey検証に興味。
WARM。
来週フォロー。`;
  const parsed = parseCaptureMessage(msg, { now: NOW });
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.draft.target_id, 'sagamihara');
  assert.equal(parsed.draft.result, 'WARM');
  assert.equal(parsed.draft.route, 'MAR');
  assert.equal(parsed.draft.due, 'CUSTOM');
});

test('TEST 03 ad-hoc target uses existing semantics', () => {
  const msg = `OISUMMIT記録
株式会社テスト
新規。
AI活用について名刺交換。
CONTACT。`;
  const parsed = parseCaptureMessage(msg, { now: NOW });
  assert.equal(parsed.status, 'ready');
  assert.match(parsed.draft.target_id, /^ADHOC_/);
  assert.equal(parsed.draft.target_name, '株式会社テスト');
  assert.equal(parsed.draft.target_type, 'company');
  assert.equal(parsed.draft.priority, 'BACKUP');
  assert.equal(parsed.draft.result, 'CONTACT');
  assert.equal(parsed.draft.contact_method, 'BUSINESS_CARD');
});

test('TEST 04 ambiguous input does not auto-write', () => {
  const parsed = parseCaptureMessage('OISUMMIT記録\nBIPROGYと話した。', { now: NOW });
  assert.equal(parsed.status, 'needs_confirmation');
  assert.ok(parsed.missing.includes('result'));
  assert.ok(parsed.questions.length >= 1);
});

test('TEST 05 invalid result blocks write validation', () => {
  const fields = buildCaptureFields({
    capture_id: 'cap-1',
    target_id: 'biprogy',
    target_name: 'BIPROGY',
    target_type: 'company',
    priority: 'MUST',
    route: 'AGENT_EXECUTION',
    result: 'SUPERHOT',
  });
  assert.ok(validateCaptureFields(fields).length);
});

test('TEST 06 auth failure has no fake success in grok API source', () => {
  const api = fs.readFileSync(path.join(ROOT, 'api/oisummit-capture-grok.js'), 'utf8');
  assert.match(api, /timingSafeEqual/);
  assert.match(api, /status: 'failed'/);
  assert.doesNotMatch(api, /saved:\s*true[\s\S]*401/);
});

test('TEST 07 airtable failure returns failed status not saved', async () => {
  const result = await writeCaptureToAirtable(buildCaptureFields({
    capture_id: 'cap-test',
    target_id: 'biprogy',
    target_name: 'BIPROGY',
    target_type: 'company',
    priority: 'MUST',
    route: 'AGENT_EXECUTION',
    result: 'HOT',
  }), {
    OISUMMIT_CAPTURE_WRITE_ENABLED: 'false',
  });
  assert.equal(result.ok, false);
  assert.equal(result.body.error, 'CONFIG_REQUIRED');
});

test('TEST 08 duplicate semantics preserved in write path', async () => {
  const originalFetch = global.fetch;
  const fields = buildCaptureFields({
    capture_id: 'dup-1',
    target_id: 'biprogy',
    target_name: 'BIPROGY',
    target_type: 'company',
    priority: 'MUST',
    route: 'AGENT_EXECUTION',
    result: 'HOT',
  });
  global.fetch = async (url, init) => {
    if (String(url).includes('filterByFormula')) {
      return { ok: true, json: async () => ({ records: [{ id: 'rec1' }] }) };
    }
    throw new Error('should not POST on duplicate');
  };
  const result = await writeCaptureToAirtable(fields, {
    OISUMMIT_CAPTURE_WRITE_ENABLED: 'true',
    AIRTABLE_API_KEY: 'key',
    AIRTABLE_BASE_ID: 'base',
    OISUMMIT_CAPTURES_TABLE_NAME: 'OISUMMIT_Captures',
  });
  global.fetch = originalFetch;
  assert.equal(result.ok, true);
  assert.equal(result.body.duplicate, true);
});

test('TEST 09 Japanese person memo next_action', () => {
  const msg = `OISUMMIT記録
NSSOL
担当: 田中太郎
AI Agent統合の技術検討に強い関心。
HOT。
打ち合わせ希望。`;
  const parsed = parseCaptureMessage(msg, { now: NOW });
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.draft.person, '田中太郎');
  assert.match(parsed.draft.memo, /技術検討/);
  assert.equal(parsed.draft.next_action, 'MEETING');
});

test('TEST 10 existing web capture contract unchanged', () => {
  const page = fs.readFileSync(path.join(ROOT, 'oisummit/capture/index.html'), 'utf8');
  const api = fs.readFileSync(path.join(ROOT, 'api/oisummit-capture.js'), 'utf8');
  assert.match(page, /ADHOC_/);
  assert.match(page, /oisummit_capture_queue_v1/);
  assert.match(api, /OISUMMIT_CAPTURE_ACCESS_TOKEN/);
  assert.match(api, /x-oisummit-auth-check/);
  assert.match(api, /writeCaptureToAirtable/);
});

test('intent detection requires explicit trigger', () => {
  assert.equal(hasCaptureIntent('BIPROGYと話した HOT'), false);
  assert.equal(hasCaptureIntent('OISUMMIT記録 BIPROGY HOT'), true);
});

test('no direct Airtable from grok API file', () => {
  const api = fs.readFileSync(path.join(ROOT, 'api/oisummit-capture-grok.js'), 'utf8');
  assert.match(api, /writeCaptureToAirtable/);
  assert.doesNotMatch(api, /api\.airtable\.com/);
});

test('target registry resolves BIPROGY and 相模原市', () => {
  assert.equal(resolveCaptureTarget('BIPROGY').target.id, 'biprogy');
  assert.equal(resolveCaptureTarget('相模原市').target.id, 'sagamihara');
});

test('preview formatter is compact', () => {
  const preview = formatPreview({
    target_name: 'BIPROGY',
    result: 'HOT',
    route: 'AGENT_EXECUTION',
    memo: 'Business Outcome Verificationに反応',
    next_action: 'MEETING',
    due: 'CUSTOM',
    contact_method: 'EMAIL',
  });
  assert.match(preview, /BIPROGY/);
  assert.match(preview, /HOT/);
  assert.match(preview, /Agent Execution/);
});
