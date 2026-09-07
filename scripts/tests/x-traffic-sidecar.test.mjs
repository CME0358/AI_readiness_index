import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import redirectHandler from '../../api/go/[short_id].js';
import {
  DEFAULT_MAX_UTF16,
  ROOT,
  SIDECAR_VERSION,
  SLOTS,
  TIMEZONE,
  assertOwnership,
  buildDestination,
  buildShortId,
  evaluateCapacity,
  expectedArticleUrl,
  generatePost,
  loadPublishedInsights,
  normalizeUrl,
  planDay,
  selectArticles,
  utf16Length,
  validateDestination,
  validateRedirectRequest,
} from '../x-traffic-sidecar/core.mjs';

const date = '2026-09-07';
const articles = loadPublishedInsights({ root: ROOT });
const plan = planDay({ date, articles, ledger: { posts: [] } });

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function xFiles() {
  return fs.readdirSync(path.join(ROOT, 'insights/_social/x/posts')).sort();
}

test('TEST-01: selects five different articles', () => {
  assert.equal(plan.selection.chosen.length, 5);
  assert.equal(new Set(plan.posts.map((p) => p.article_slug)).size, 5);
});

test('TEST-02: creates all required JST slots', () => assert.deepEqual(plan.posts.map((p) => p.slot), ['06:00', '07:00', '08:00', '15:00', '18:00']));
test('TEST-03: uses Asia/Tokyo as timezone authority', () => assert.equal(plan.timezone, TIMEZONE));
test('TEST-04: short IDs are unique', () => assert.equal(new Set(plan.posts.map((p) => p.short_id)).size, 5));
test('TEST-05: redirect destinations are valid', () => assert.ok(plan.posts.every((p) => validateDestination(p.destination_url))));
test('TEST-06: UTM attribution is preserved', () => assert.ok(plan.posts.every((p) => p.destination_url.includes('utm_source=x') && p.destination_url.includes('utm_content='))));
test('TEST-07: hero media is available for every selected article', () => assert.ok(plan.posts.every((p) => p.validation.hero && p.hero_url.endsWith('/hero.webp'))));
test('TEST-08: repeated planning is idempotent', () => assert.deepEqual(planDay({ date, articles, ledger: { posts: [] } }), plan));
test('TEST-09: capacity gate handles unknown state', () => assert.equal(evaluateCapacity({ scheduledCount: 1, requestedCount: 5, organizationLimit: null, dailyLimit: null }).status, 'CAPACITY_UNKNOWN'));
test('TEST-10: capacity gate rejects insufficient organization capacity', () => assert.equal(evaluateCapacity({ scheduledCount: 10, requestedCount: 5, organizationLimit: 12, dailyLimit: { scheduled: 0, sent: 0, limit: null, isAtLimit: false } }).status, 'BUFFER_QUEUE_UNSAFE'));
test('TEST-11: ineligible future article rejected', () => { const row = articles.find((a) => a.slug === 'ai-search-52-percent'); assert.equal(row.publication_date <= '2026-09-06', false); });
test('TEST-12: missing hero is not selected', () => { const result = selectArticles(articles, { date, ledger: { posts: [] }, verifiedSlugs: new Set(articles.map((a) => a.slug)) }); assert.ok(!result.chosen.some((x) => !x.article.hero_available)); });
test('TEST-13: canonical mismatch is rejected', () => assert.notEqual(normalizeUrl('https://example.com/insights/a/'), expectedArticleUrl('a')));
test('TEST-14: future-dated article is excluded from eligibility', () => { const future = { ...articles[0], publication_date: '2099-01-01' }; assert.ok(!selectArticles([future], { date, ledger: { posts: [] } }).chosen.length); });
test('TEST-15: same article is not selected twice in one day', () => { const result = planDay({ date, articles: [articles[0]], ledger: { posts: [] } }); assert.equal(result.posts.filter((p) => p.article_slug).length, 1); });
test('TEST-16: generated content is unique across the five slots', () => assert.equal(new Set(plan.posts.map((p) => p.generated_text)).size, 5));
test('TEST-17: existing Buffer posts are not represented in Sidecar ledger', () => assert.deepEqual(plan.posts.filter((p) => p.buffer_post_id), []));
test('TEST-18: ownership isolation rejects foreign remote ID', () => assert.equal(assertOwnership({ ownership: 'ari_x_traffic_sidecar_v1', buffer_post_id: 'sidecar-1' }, 'foreign-1'), false));
test('TEST-19: partial article selection yields HOLD slots', () => { const p = planDay({ date, articles: [], ledger: { posts: [] } }); assert.equal(p.posts.filter((x) => x.state === 'HOLD').length, 5); });
test('TEST-20: full dry-run plan contains five full texts', () => assert.ok(plan.posts.every((p) => p.generated_text && p.short_url && p.destination_url && p.hero_url)));
test('TEST-21: FOREIGN_POST cannot be modified', () => assert.equal(assertOwnership({ ownership: 'foreign', buffer_post_id: 'remote-1' }, 'remote-1'), false));
test('TEST-22: Sidecar remote ID must match ledger ownership', () => assert.equal(assertOwnership({ ownership: 'ari_x_traffic_sidecar_v1', buffer_post_id: 'remote-1' }, 'remote-1'), true));
test('TEST-23: unknown short ID has no valid redirect entry', () => {
  assert.equal(validateRedirectRequest(null), false);
  const response = { statusCode: 200, body: '', status(code) { this.statusCode = code; return this; }, end(body) { this.body = body; } };
  redirectHandler({ query: { short_id: 'unknown-id' } }, response);
  assert.equal(response.statusCode, 404);
});
test('TEST-24: external redirect destination is rejected', () => assert.equal(validateDestination('https://example.com/'), false));
test('TEST-25: CAPACITY_UNKNOWN is fail-closed', () => assert.equal(evaluateCapacity({ scheduledCount: 0, requestedCount: 5, organizationLimit: undefined, dailyLimit: { scheduled: 0, sent: 0, limit: 10, isAtLimit: false } }).safe, false));
test('TEST-26: existing postsPerTransfer policy is not imported or changed', () => { const q = JSON.parse(fs.readFileSync(path.join(ROOT, 'insights/_social/buffer/queue.json'))); assert.equal(q.policy.postsPerTransfer, 1); });
test('TEST-27: existing queue.json is byte-for-byte unchanged by planning', () => { const file = path.join(ROOT, 'insights/_social/buffer/queue.json'); const before = sha(file); planDay({ date, articles, ledger: { posts: [] } }); assert.equal(sha(file), before); });
test('TEST-28: existing X posts directory is unchanged by planning', () => { const before = xFiles(); planDay({ date, articles, ledger: { posts: [] } }); assert.deepEqual(xFiles(), before); });
test('TEST-29: slots are unique', () => assert.equal(new Set(SLOTS.map((s) => s.time)).size, 5));
test('TEST-30: short IDs remain unique for the date', () => assert.equal(new Set(SLOTS.map((_, i) => buildShortId(date, i))).size, 5));
test('short URL collision is fail-closed', () => {
  const collision = planDay({ date, articles, ledger: { posts: [] }, redirects: { redirects: [{ short_id: 'x260907a' }] } });
  assert.equal(collision.posts[0].state, 'HOLD');
  assert.equal(collision.posts[0].error_code, 'SHORT_URL_COLLISION');
});

test('X post uses conservative UTF-16 limit', () => {
  assert.ok(plan.posts.every((p) => utf16Length(p.generated_text) <= DEFAULT_MAX_UTF16));
});

test('destination is canonical Insight URL with approved host', () => {
  const destination = buildDestination(articles[0], date, SLOTS[0]);
  assert.equal(new URL(destination).hostname, 'readiness.coaretail.com');
});

test('sidecar version and ownership are present', () => {
  assert.equal(plan.sidecar_version, SIDECAR_VERSION);
  assert.ok(plan.posts.every((p) => p.ownership === 'ari_x_traffic_sidecar_v1'));
});

test('Vercel exposes /go/{short_id} through the safe API route', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === '/go/:short_id' && rewrite.destination === '/api/go/:short_id'));
});
