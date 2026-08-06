import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJstDateString, isWeekday, businessDaysFrom } from '../lib/business-days.mjs';
import { validateArticleHtml } from '../lib/url-verify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const QUEUE_PATH = path.join(ROOT, 'insights/_social/linkedin/queue.json');

test('businessDaysFrom returns weekdays only', () => {
  const days = businessDaysFrom('2026-08-04', 5);
  assert.equal(days.length, 5);
  for (const d of days) {
    const dt = new Date(d + 'T12:00:00+09:00');
    assert.ok(isWeekday(dt), d);
  }
});

test('queue postsPerTransfer is 1', () => {
  const q = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  assert.equal(q.policy.postsPerTransfer, 1);
  assert.equal(q.posts.length, 30);
});

test('no duplicate slugs in queue', () => {
  const q = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const slugs = q.posts.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('no duplicate articleUrl in queue', () => {
  const q = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const urls = q.posts.map((p) => p.articleUrl);
  assert.equal(new Set(urls).size, urls.length);
});

test('validateArticleHtml rejects noindex', () => {
  const html = '<html><head><meta name="robots" content="noindex"></head><body><h1>T</h1><div class="article-cta"></div></html>';
  const r = validateArticleHtml(html, 'test', 'https://readiness.coaretail.com/insights/test/');
  assert.equal(r.ok, false);
});

test('pick today uses JST date string', () => {
  const d = new Date('2026-08-05T01:30:00Z');
  assert.equal(toJstDateString(d), '2026-08-05');
});

test('production gate: linkedin queue counts', () => {
  const q = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const scheduled = q.posts.filter((p) => p.status === 'scheduled');
  const hold = q.posts.filter((p) => p.status === 'editorial_hold');
  const queued = q.posts.filter((p) => p.status === 'buffer_queued');
  assert.ok(scheduled.length <= 1, `scheduled=${scheduled.length}`);
  assert.equal(scheduled.length + hold.length + queued.length, 30);
  for (const p of hold) {
    assert.equal(p.bufferTransferAt, null);
    assert.equal(p.linkedinPublishAt, null);
  }
});

test('production gate: schedule v2 status counts', () => {
  const schedulePath = path.join(ROOT, 'insights/_scheduled/schedule.json');
  const s = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  const v2scheduled = s.articles.filter((a) => a.series === 'v2' && a.status === 'scheduled');
  const v2hold = s.articles.filter((a) => a.series === 'v2' && a.status === 'editorial_hold');
  const v2published = s.articles.filter((a) => a.series === 'v2' && a.status === 'published');
  assert.ok(v2scheduled.length <= 1, `scheduled=${v2scheduled.length}`);
  assert.equal(v2scheduled.length + v2hold.length + v2published.length, 30);
});
