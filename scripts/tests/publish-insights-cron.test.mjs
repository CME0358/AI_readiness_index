import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPublishNowIso,
  dispatchGitHubWorkflow,
  handlePublishInsightsCron,
  parseGitHubRepo,
  verifyCronAuth,
  PUBLISH_WORKFLOW_FILE,
} from '../lib/github-workflow-dispatch.mjs';

test('buildPublishNowIso uses JST 10:00 wall clock', () => {
  const iso = buildPublishNowIso(new Date('2026-08-10T01:05:00.000Z'));
  assert.equal(iso, '2026-08-10T10:00:00+09:00');
});

test('parseGitHubRepo splits owner/name', () => {
  assert.deepEqual(parseGitHubRepo('CME0358/AI_readiness_index'), {
    owner: 'CME0358',
    name: 'AI_readiness_index',
  });
});

test('verifyCronAuth accepts bearer token', () => {
  const req = { headers: { authorization: 'Bearer secret-token' } };
  assert.deepEqual(verifyCronAuth(req, 'secret-token'), { ok: true });
  assert.equal(verifyCronAuth(req, 'other').ok, false);
  assert.equal(verifyCronAuth(req, '').reason, 'CRON_SECRET not configured');
});

test('dispatchGitHubWorkflow posts workflow_dispatch', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return { status: 204, json: async () => ({}) };
  };

  const result = await dispatchGitHubWorkflow({
    workflowFile: PUBLISH_WORKFLOW_FILE,
    token: 'ghp_test',
    inputs: { now: '2026-08-10T10:00:00+09:00' },
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.match(captured.url, /reconcile-publishing-pipeline\.yml\/dispatches$/);
  assert.equal(JSON.parse(captured.init.body).inputs.now, '2026-08-10T10:00:00+09:00');
});

test('handlePublishInsightsCron skips weekends', async () => {
  const sunday = new Date('2026-08-09T01:00:00.000Z');
  const { status, body } = await handlePublishInsightsCron(
    { headers: { authorization: 'Bearer cron-secret' } },
    {
      CRON_SECRET: 'cron-secret',
      GITHUB_DISPATCH_TOKEN: 'ghp_test',
      now: sunday,
      fetchImpl: async () => ({ status: 204, json: async () => ({}) }),
    }
  );
  assert.equal(status, 200);
  assert.equal(body.skipped, true);
});

test('handlePublishInsightsCron dispatches on weekday', async () => {
  let dispatched = false;
  const monday = new Date('2026-08-10T01:00:00.000Z');
  const { status, body } = await handlePublishInsightsCron(
    { headers: { authorization: 'Bearer cron-secret' } },
    {
      CRON_SECRET: 'cron-secret',
      GITHUB_DISPATCH_TOKEN: 'ghp_test',
      now: monday,
      fetchImpl: async () => {
        dispatched = true;
        return { status: 204, json: async () => ({}) };
      },
    }
  );

  assert.equal(status, 200);
  assert.equal(body.dispatched, true);
  assert.equal(body.now, '2026-08-10T10:00:00+09:00');
  assert.equal(dispatched, true);
});

test('vercel.json defines weekday publish cron', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const cron = vercel.crons?.find((c) => c.path === '/api/cron/publish-insights');
  assert.ok(cron, 'publish-insights cron missing');
  assert.equal(cron.schedule, '0 0 * * 1-5');
});

test('reconcile workflow includes primary weekday publish crons', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const wf = fs.readFileSync(
    path.join(root, '.github/workflows/reconcile-publishing-pipeline.yml'),
    'utf8'
  );
  assert.match(wf, /cron: '0,15,30,45 1-3 \* \* 1-5'/);
  assert.match(wf, /cron: '0 4 \* \* 1-5'/);
});

test('deprecated publish workflow retained as fallback', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const wf = fs.readFileSync(
    path.join(root, '.github/workflows/publish-scheduled-insights.yml'),
    'utf8'
  );
  assert.match(wf, /deprecated fallback/);
  assert.doesNotMatch(wf, /schedule:/);
  assert.match(wf, /workflow_dispatch:/);
});
