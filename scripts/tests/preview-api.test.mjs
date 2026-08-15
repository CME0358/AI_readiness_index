#!/usr/bin/env node
/**
 * P2 — Preview API tests (persistent store abstraction).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/preview/[token].js';
import {
  MemoryPreviewSnapshotStore,
  PreviewStoreError,
  resetPreviewSnapshotStore,
} from '../lib/preview-snapshot-store.mjs';
import { publicSnapshotView, isValidToken } from '../lib/preview-snapshot-schema.mjs';

const FIXTURE = {
  version: 1,
  token: 'api-test-token',
  company_name: 'API Test Co',
  url: 'https://api.example',
  industry: 'その他',
  video_segment: 'membership',
  created_at: '2026-08-15T00:00:00+00:00',
  expires_at: '2027-08-15T00:00:00+00:00',
  preview: {
    observations: [{ code: 'OBS_FAQ_STRUCTURE_WEAK', copy: 'FAQ弱い' }],
    check_summary: { checked_count: 1, total_teaser: 23, check_items: [] },
    blocked: false,
  },
};

function mockReqRes(url, method = 'GET') {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = body; },
  };
  return { req: { url, method }, res };
}

test.beforeEach(async () => {
  process.env.PREVIEW_STORE_BACKEND = 'memory';
  process.env.PREVIEW_STORE_SILENT = '1';
  resetPreviewSnapshotStore();
  const store = new MemoryPreviewSnapshotStore();
  await store.save(FIXTURE);
  // monkey-patch singleton
  resetPreviewSnapshotStore();
  process.env.PREVIEW_STORE_BACKEND = 'memory';
});

test('API — valid token 200 public-safe', async () => {
  const store = new MemoryPreviewSnapshotStore();
  await store.save(FIXTURE);
  resetPreviewSnapshotStore();
  // inject via global singleton by saving through module
  const { getPreviewSnapshotStore } = await import('../lib/preview-snapshot-store.mjs');
  const singleton = getPreviewSnapshotStore();
  await singleton.save(FIXTURE);

  const { req, res } = mockReqRes('/api/preview/api-test-token');
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.company_name, 'API Test Co');
  assert.equal(data._evidence, undefined);
});

test('API — unknown 404', async () => {
  resetPreviewSnapshotStore();
  process.env.PREVIEW_STORE_BACKEND = 'memory';
  const { req, res } = mockReqRes('/api/preview/does-not-exist');
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('API — malformed token 404', async () => {
  assert.equal(isValidToken('bad token!'), false);
  const { req, res } = mockReqRes('/api/preview/bad%20token');
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('API — expired 404', async () => {
  resetPreviewSnapshotStore();
  process.env.PREVIEW_STORE_BACKEND = 'memory';
  const { getPreviewSnapshotStore } = await import('../lib/preview-snapshot-store.mjs');
  const store = getPreviewSnapshotStore();
  await store.save({
    ...FIXTURE,
    token: 'expired-api',
    expires_at: '2020-01-01T00:00:00+00:00',
  });
  const { req, res } = mockReqRes('/api/preview/expired-api');
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('publicSnapshotView strips internal evidence', () => {
  const view = publicSnapshotView({ ...FIXTURE, _evidence: { faq: 0 } });
  assert.equal(view._evidence, undefined);
  assert.equal(view.video_segment, 'membership');
});

test('publicSnapshotView — legacy generic normalized to membership', () => {
  const view = publicSnapshotView({ ...FIXTURE, video_segment: 'generic' });
  assert.equal(view.video_segment, 'membership');
});

test('publicSnapshotView — missing video_segment defaults membership', () => {
  const { video_segment: _drop, ...legacy } = FIXTURE;
  const view = publicSnapshotView(legacy);
  assert.equal(view.video_segment, 'membership');
});

test('API — no score/evidence in body', async () => {
  resetPreviewSnapshotStore();
  process.env.PREVIEW_STORE_BACKEND = 'memory';
  const { getPreviewSnapshotStore } = await import('../lib/preview-snapshot-store.mjs');
  await getPreviewSnapshotStore().save(FIXTURE);
  const { req, res } = mockReqRes('/api/preview/api-test-token');
  await handler(req, res);
  assert.doesNotMatch(res.body, /_evidence|overallScore|total_score|"faq":\s*\d+/);
});

test('API — store unavailable 503', async () => {
  resetPreviewSnapshotStore();
  process.env.PREVIEW_STORE_BACKEND = 'upstash';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const { req, res } = mockReqRes('/api/preview/api-test-token');
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  resetPreviewSnapshotStore();
  process.env.PREVIEW_STORE_BACKEND = 'memory';
});
