import test from 'node:test';
import assert from 'node:assert/strict';
import { isWeekday, toJstDateString } from '../lib/business-days.mjs';
import {
  extractDueArticles,
  selectNextDueArticle,
} from '../lib/editorial-status.mjs';
import {
  deriveScheduleOperationalState,
  isProductionVerified,
  OPERATIONAL_STATES,
} from '../lib/publishing-state-machine.mjs';
import { pickBufferEligibleArticle } from '../lib/buffer-dispatcher.mjs';
import { CHANNEL_STATUSES } from '../lib/social-channels.mjs';
import { resolvePublishAt } from '../lib/social-schedule.mjs';
import { millisecondsUntilPublishTarget } from '../lib/publish-window.mjs';
import { validateChannelContent, processArticleChannels } from '../lib/buffer-dispatcher.mjs';

const mondayTen = new Date('2026-08-17T01:00:00.000Z');
const today = { slug: 'today', status: 'scheduled', publishAt: '2026-08-17T10:00:00+09:00' };

function bufferPost(slug = 'today') {
  return {
    slug,
    status: 'scheduled',
    articlePublishAt: '2026-08-17T10:00:00+09:00',
    channels: {
      linkedin: { status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null },
      facebook: { status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null },
      x: { status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null },
    },
  };
}

test('weekday 10:00 JST is eligible', () => {
  assert.equal(isWeekday(mondayTen), true);
  assert.deepEqual(extractDueArticles([today], mondayTen).map((a) => a.slug), ['today']);
});

test('UTC/JST conversion retains the intended business date', () => {
  assert.equal(toJstDateString(mondayTen), '2026-08-17');
  assert.equal(new Date(today.publishAt).toISOString(), '2026-08-17T01:00:00.000Z');
});

test('pre-trigger waits until 10:00 JST and never publishes early', () => {
  const wait = millisecondsUntilPublishTarget(
    '2026-08-17T10:00:00+09:00',
    new Date('2026-08-17T00:15:00.000Z')
  );
  assert.equal(wait, 45 * 60_000);
  assert.equal(millisecondsUntilPublishTarget(today.publishAt, mondayTen), 0);
});

test('deterministic selection is independent of array order', () => {
  const sameTimeA = { ...today, slug: 'a' };
  const sameTimeB = { ...today, slug: 'b' };
  assert.equal(selectNextDueArticle([sameTimeB, sameTimeA], mondayTen).slug, 'a');
  assert.equal(selectNextDueArticle([sameTimeA, sameTimeB], mondayTen).slug, 'a');
});

test('missed 10:00 remains recoverable later that day', () => {
  const late = new Date('2026-08-17T04:00:00.000Z');
  assert.equal(selectNextDueArticle([today], late).slug, 'today');
});

test('repeated selection is idempotent and selects exactly one article', () => {
  const first = selectNextDueArticle([today], mondayTen);
  const second = selectNextDueArticle([today], mondayTen);
  assert.equal(first.slug, second.slug);
});

test('already-published articles are excluded', () => {
  const published = { ...today, status: 'published' };
  assert.equal(selectNextDueArticle([published], mondayTen), null);
});

test('previous overdue article cannot block today article', () => {
  const previous = { slug: 'previous', status: 'scheduled', publishAt: '2026-08-14T10:00:00+09:00' };
  assert.equal(selectNextDueArticle([previous, today], mondayTen).slug, 'today');
});

test('oldest overdue article is recovered when no article belongs to today', () => {
  const older = { slug: 'older', status: 'scheduled', publishAt: '2026-08-13T10:00:00+09:00' };
  const newer = { slug: 'newer', status: 'scheduled', publishAt: '2026-08-14T10:00:00+09:00' };
  assert.equal(selectNextDueArticle([newer, older], mondayTen).slug, 'older');
});

test('Buffer is blocked before production verification', () => {
  const queue = { posts: [bufferPost()] };
  const schedule = { articles: [{ ...today, status: 'published' }] };
  assert.equal(pickBufferEligibleArticle(queue, { schedule }), null);
  assert.equal(isProductionVerified(schedule.articles[0]), false);
});

test('force-slug does not bypass production verification', () => {
  const queue = { posts: [bufferPost()] };
  const schedule = { articles: [{ ...today, status: 'published' }] };
  assert.equal(pickBufferEligibleArticle(queue, { forceSlug: 'today', schedule }), null);
});

test('Buffer is eligible after production verification', () => {
  const queue = { posts: [bufferPost()] };
  const schedule = {
    articles: [{ ...today, status: 'published', productionVerifiedAt: '2026-08-17T01:05:00.000Z' }],
  };
  assert.equal(pickBufferEligibleArticle(queue, { schedule }).slug, 'today');
});

test('missed 10:30 Buffer time is bumped and remains recoverable', () => {
  const late = new Date('2026-08-17T04:00:00.000Z');
  const bumped = resolvePublishAt('2026-08-17T10:30:00+09:00', late, 30);
  assert.ok(new Date(bumped).getTime() >= late.getTime() + 30 * 60_000);
});

test('failed publication remains publish_due for reconciliation retry', () => {
  const failed = { ...today, publishAttemptedAt: '2026-08-17T01:00:00.000Z', lastPublishFailure: 'quality_gate' };
  assert.equal(
    deriveScheduleOperationalState(failed, { now: new Date('2026-08-17T01:15:00.000Z') }),
    OPERATIONAL_STATES.PUBLISH_DUE
  );
  assert.equal(selectNextDueArticle([failed], new Date('2026-08-17T01:15:00.000Z')).slug, 'today');
});

test('today Facebook content passes its channel validation before recovery', async () => {
  const fs = await import('node:fs');
  const text = fs.readFileSync('insights/_social/facebook/posts/search-departure-ai.md', 'utf8').trim();
  assert.equal(
    validateChannelContent('facebook', text, 'https://readiness.coaretail.com/insights/search-departure-ai/').ok,
    true
  );
});

test('one channel failure is persisted and only that channel is retried', async () => {
  const article = bufferPost('channel-retry');
  article.articleUrl = 'https://readiness.coaretail.com/insights/ai-search-shift/';
  for (const ch of ['linkedin', 'facebook', 'x']) {
    article.channels[ch].channelIdEnv = `BUFFER_CHANNEL_ID_${ch === 'x' ? 'TWITTER' : ch.toUpperCase()}`;
    article.channels[ch].contentFile = `insights/_social/${ch}/posts/ai-search-shift.md`;
    article.channels[ch].publishAt = `2026-08-17T${ch === 'linkedin' ? '11:30' : ch === 'facebook' ? '11:45' : '12:00'}:00+09:00`;
  }
  const queue = { posts: [article] };
  const created = [];
  const config = () => ({
    accessToken: 'token',
    channelId: '',
    channelIds: { linkedin: 'li', facebook: 'fb', x: 'x' },
  });
  const paths = {
    queue: '/tmp/ari-buffer-retry-queue.json',
    publishedLog: '/tmp/ari-buffer-retry-published.json',
    failedLog: '/tmp/ari-buffer-retry-failed.json',
  };

  const first = await processArticleChannels({
    article,
    queue,
    now: new Date('2026-08-17T01:01:00.000Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyArticleUrl: async () => ({ ok: true }),
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      return channelKey === 'facebook'
        ? { postId: null, error: 'facebook rejected fixture', rejected: false }
        : { postId: `${channelKey}-id`, error: null, rejected: false, dueAtUtc: '2026-08-17T02:30:00.000Z' };
    },
    getConfig: config,
    paths,
  });
  assert.equal(first.exitCode, 1);
  assert.equal(article.channels.linkedin.status, CHANNEL_STATUSES.QUEUED);
  assert.equal(article.channels.facebook.status, CHANNEL_STATUSES.FAILED);
  assert.equal(article.channels.x.status, CHANNEL_STATUSES.QUEUED);

  created.length = 0;
  const second = await processArticleChannels({
    article,
    queue,
    now: new Date('2026-08-17T01:05:00.000Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyArticleUrl: async () => ({ ok: true }),
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      return { postId: `${channelKey}-recovered`, error: null, rejected: false, dueAtUtc: '2026-08-17T02:45:00.000Z' };
    },
    getConfig: config,
    paths,
  });
  assert.equal(second.exitCode, 0);
  assert.deepEqual(created, ['facebook']);
  assert.equal(article.status, 'buffer_queued');
});

test('deprecated automatic publication and Buffer schedules are disabled', async () => {
  const fs = await import('node:fs');
  for (const file of [
    '.github/workflows/publish-scheduled-insights.yml',
    '.github/workflows/queue-daily-buffer-posts.yml',
  ]) {
    const workflow = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(workflow, /^  schedule:/m);
    assert.match(workflow, /^  workflow_dispatch:/m);
  }
});
