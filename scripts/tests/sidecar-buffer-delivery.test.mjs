import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLedgerRecord,
  buildRedirectRecord,
  deliverSidecarPlan,
  findLedgerEntry,
  isPlanPostDeliverable,
  isSlotSchedulable,
  upsertLedgerEntry,
  upsertRedirect,
} from '../lib/sidecar-buffer-delivery.mjs';

const basePost = {
  sidecar_post_id: 'ari-x-2026-09-08-1500',
  date: '2026-09-08',
  slot: '15:00',
  article_slug: 'recommendation-logic',
  article_title: 'Test',
  article_url: 'https://readiness.coaretail.com/insights/recommendation-logic/',
  content_angle: 'DISCOVERY',
  generated_text: 'Post body\n\nhttps://readiness.coaretail.com/go/x260908d',
  short_id: 'x260908d',
  short_url: 'https://readiness.coaretail.com/go/x260908d',
  destination_url: 'https://readiness.coaretail.com/insights/recommendation-logic/?utm_source=x&utm_medium=organic&utm_campaign=ari_x_traffic&utm_content=260908_1500',
  hero_url: 'https://readiness.coaretail.com/assets/insights/recommendation-logic/hero.webp',
  scheduled_at: '2026-09-08T15:00:00+09:00',
  state: 'GENERATED',
  validation: { article: true, canonical: true, hero: true, short_url_unique: true, short_url_in_text: true, redirect_target_valid: true, x_length_valid: true, utf16_length: 120 },
};

test('isPlanPostDeliverable accepts valid planned post', () => {
  assert.equal(isPlanPostDeliverable(basePost), true);
});

test('isSlotSchedulable rejects past slots', () => {
  const now = new Date('2026-09-08T16:00:00+09:00');
  assert.equal(isSlotSchedulable(basePost.scheduled_at, now), false);
});

test('deliverSidecarPlan dry-run skips past slots', async () => {
  const plan = { posts: [basePost] };
  const result = await deliverSidecarPlan({
    plan,
    ledger: { posts: [] },
    redirects: { redirects: [] },
    cfg: { accessToken: 'token', organizationId: 'org', channelIds: { x: 'channel-x' } },
    now: new Date('2026-09-08T16:00:00+09:00'),
    dryRun: true,
    assertLive: () => ({}),
    paths: { ledger: '/tmp/ledger.json', redirects: '/tmp/redirects.json' },
  });
  assert.equal(result.results[0].reason, 'past_slot');
});

test('deliverSidecarPlan queues future slot and updates ledger', async () => {
  const futurePost = {
    ...basePost,
    sidecar_post_id: 'ari-x-2026-09-09-1500',
    date: '2026-09-09',
    scheduled_at: '2026-09-09T15:00:00+09:00',
    short_id: 'x260909d',
    short_url: 'https://readiness.coaretail.com/go/x260909d',
    generated_text: 'Post body\n\nhttps://readiness.coaretail.com/go/x260909d',
  };
  const plan = { posts: [futurePost] };
  const createPost = async () => ({ postId: 'buffer-123', dueAtUtc: '2026-09-09T06:00:00Z' });
  const result = await deliverSidecarPlan({
    plan,
    ledger: { posts: [] },
    redirects: { redirects: [] },
    cfg: { accessToken: 'token', organizationId: 'org', channelIds: { x: 'channel-x' } },
    now: new Date('2026-09-08T12:00:00+09:00'),
    dryRun: false,
    createPost,
    assertLive: () => ({}),
    paths: { ledger: '/tmp/ledger.json', redirects: '/tmp/redirects.json' },
  });
  assert.equal(result.results[0].action, 'queued');
  assert.equal(findLedgerEntry(result.ledger, futurePost.sidecar_post_id).buffer_post_id, 'buffer-123');
  assert.equal(result.redirects.redirects[0].short_id, 'x260909d');
});

test('ledger and redirect builders preserve ownership', () => {
  const record = buildLedgerRecord(basePost, { bufferPostId: 'buffer-1' });
  const redirect = buildRedirectRecord(basePost);
  assert.equal(record.ownership, 'ari_x_traffic_sidecar_v1');
  assert.equal(redirect.ownership, 'ari_x_traffic_sidecar_v1');
});

test('deliverSidecarPlan rejects posts missing short URL in text', async () => {
  const badPost = { ...basePost, generated_text: 'no url here', validation: { ...basePost.validation, short_url_in_text: false } };
  const plan = { posts: [badPost] };
  const result = await deliverSidecarPlan({
    plan,
    ledger: { posts: [] },
    redirects: { redirects: [] },
    cfg: { accessToken: 'token', organizationId: 'org', channelIds: { x: 'channel-x' } },
    now: new Date('2026-09-08T12:00:00+09:00'),
    dryRun: false,
    createPost: async () => ({ postId: 'should-not-run' }),
    assertLive: () => ({}),
    paths: { ledger: '/tmp/ledger.json', redirects: '/tmp/redirects.json' },
  });
  assert.equal(result.results[0].reason, 'not_deliverable');
});

test('upsert helpers are idempotent by sidecar_post_id / short_id', () => {
  const record = buildLedgerRecord(basePost, { bufferPostId: 'buffer-1' });
  const once = upsertLedgerEntry({ posts: [] }, record);
  const twice = upsertLedgerEntry(once, { ...record, buffer_post_id: 'buffer-2' });
  assert.equal(twice.posts.length, 1);
  assert.equal(twice.posts[0].buffer_post_id, 'buffer-2');
  const redirects = upsertRedirect({ redirects: [] }, basePost);
  const redirects2 = upsertRedirect(redirects, basePost);
  assert.equal(redirects2.redirects.length, 1);
});
