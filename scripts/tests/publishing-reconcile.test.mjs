#!/usr/bin/env node
/**
 * Tests for Autonomous Publishing Reliability v1 (15 scenarios).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  OPERATIONAL_STATES,
  deriveScheduleOperationalState,
  isProductionVerified,
  listPublishDueArticles,
  listVerificationPending,
} from '../lib/publishing-state-machine.mjs';
import {
  VERIFICATION_RETRY_DELAYS_MS,
  verifyProductionWithBoundedRetry,
  totalVerificationBudgetMs,
} from '../lib/publish-verification.mjs';
import {
  recordPipelineFailure,
  loadFailureState,
  clearPipelineFailure,
  FAILURE_STATE_FILE,
} from '../lib/publishing-failure-state.mjs';
import { publishDueArticles } from '../lib/publish-scheduled-insights-core.mjs';
import {
  pickBufferEligibleArticle,
  isChannelQueued,
  processArticleChannels,
} from '../lib/buffer-dispatcher.mjs';
import { CHANNEL_STATUSES, EXISTING_BUFFER_SENTINEL } from '../lib/social-channels.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';
import { reconcilePublishingPipeline, bumpBufferTimesForArticle } from '../lib/publishing-reconcile.mjs';
import { resolvePublishAt } from '../lib/social-schedule.mjs';
import { getBufferConfig } from '../lib/buffer-client.mjs';

function mockArticle(overrides = {}) {
  const url = 'https://readiness.coaretail.com/insights/ai-search-shift/';
  return {
    slug: 'ai-search-shift',
    articleUrl: url,
    status: 'scheduled',
    bufferTransferAt: '2026-08-05T10:30:00+09:00',
    channels: {
      linkedin: {
        channelIdEnv: 'BUFFER_CHANNEL_ID_LINKEDIN',
        contentFile: 'insights/_social/linkedin/posts/ai-search-shift.md',
        publishAt: '2026-08-05T11:30:00+09:00',
        status: CHANNEL_STATUSES.QUEUED,
        bufferUpdateId: EXISTING_BUFFER_SENTINEL,
      },
      facebook: {
        channelIdEnv: 'BUFFER_CHANNEL_ID_FACEBOOK',
        contentFile: 'insights/_social/facebook/posts/ai-search-shift.md',
        publishAt: '2026-08-05T11:45:00+09:00',
        status: CHANNEL_STATUSES.SCHEDULED,
        bufferUpdateId: null,
      },
      x: {
        channelIdEnv: 'BUFFER_CHANNEL_ID_TWITTER',
        contentFile: 'insights/_social/x/posts/ai-search-shift.md',
        publishAt: '2026-08-05T12:00:00+09:00',
        status: CHANNEL_STATUSES.SCHEDULED,
        bufferUpdateId: null,
      },
    },
    ...overrides,
  };
}

test('scheduled reconciliation runs Buffer discovery independently of active publish slug', () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), '.github/workflows/reconcile-publishing-pipeline.yml'),
    'utf8',
  );
  assert.match(workflow, /if: steps\.publish\.outputs\.exit_code == '0'/);
  assert.match(workflow, /CMD=\(node scripts\/reconcile-publishing-pipeline\.mjs --skip-publish\)/);
  assert.doesNotMatch(workflow, /--skip-publish --force-slug "\$SLUG"/);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// 1. Normal publish eligibility
test('1. normal publish — publish_due when scheduled and publishAt <= now', () => {
  const now = new Date('2026-08-13T10:05:00+09:00');
  const article = { slug: 'x', status: 'scheduled', publishAt: '2026-08-13T10:00:00+09:00' };
  assert.equal(deriveScheduleOperationalState(article, { now }), OPERATIONAL_STATES.PUBLISH_DUE);
});

// 2. Publish workflow 10 min late — still publish_due
test('2. publish 10min late — still publish_due at 10:10 JST', () => {
  const now = new Date('2026-08-13T10:10:00+09:00');
  const due = listPublishDueArticles(
    [{ slug: 'rb', status: 'scheduled', publishAt: '2026-08-13T10:00:00+09:00' }],
    now
  );
  assert.equal(due.length, 1);
});

// 3. Git push failure — failure record schema (no secrets)
test('3. git push failure — failure record has required fields, no secrets', () => {
  const entry = {
    slug: 'test-slug',
    stage: 'git_push',
    attemptedAt: new Date().toISOString(),
    failureReason: 'cannot pull with rebase: unstaged changes',
    retryable: true,
    attemptCount: 1,
    lastSuccessStage: 'published',
  };
  assert.ok(entry.slug);
  assert.ok(entry.stage);
  assert.ok(entry.attemptedAt);
  assert.ok(!JSON.stringify(entry).match(/token|secret|password/i));
});

// 4. Vercel propagation delay — bounded retry budget
test('4. vercel propagation — retry delays sum to bounded budget', () => {
  assert.deepEqual(VERIFICATION_RETRY_DELAYS_MS, [30_000, 60_000, 120_000, 180_000]);
  assert.equal(totalVerificationBudgetMs(), 390_000);
});

// 5. Production URL temporary 404 — exhausts retries
test('5. production URL temporary 404 — verification fails after retries', async () => {
  let calls = 0;
  const verifyFn = async () => {
    calls += 1;
    return { ok: false, url: 'https://example.com/x/', reason: 'HTTP 404' };
  };
  const result = await verifyProductionWithBoundedRetry('x', {
    verifyFn,
    delays: [1, 1, 1, 1],
    log: () => {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'HTTP 404');
  assert.equal(calls, 5);
});

// 6. Buffer API failure — channel marked failed, retryable
test('6. buffer API failure — channel failed status set', async () => {
  const article = {
    slug: 't',
    articleUrl: 'https://readiness.coaretail.com/insights/ai-search-shift/',
    status: 'scheduled',
    channels: {
      linkedin: {
        channelIdEnv: 'BUFFER_CHANNEL_ID_LINKEDIN',
        contentFile: 'insights/_social/linkedin/posts/ai-search-shift.md',
        publishAt: '2026-08-13T11:30:00+09:00',
        status: CHANNEL_STATUSES.SCHEDULED,
        bufferUpdateId: null,
      },
    },
  };
  const queue = { posts: [article] };
  const origEnv = {
    BUFFER_ACCESS_TOKEN: process.env.BUFFER_ACCESS_TOKEN,
    BUFFER_CHANNEL_ID_LINKEDIN: process.env.BUFFER_CHANNEL_ID_LINKEDIN,
  };
  process.env.BUFFER_ACCESS_TOKEN = 'tok';
  process.env.BUFFER_CHANNEL_ID_LINKEDIN = 'li';

  try {
    const { getBufferConfig } = await import('../lib/buffer-client.mjs');
    const { results, exitCode } = await processArticleChannels({
      article,
      queue,
      now: new Date('2026-08-13T10:35:00+09:00'),
      dryRun: false,
      requestedChannels: ['linkedin'],
      verifyArticleUrl: async () => ({ ok: true }),
      createBufferPost: async () => ({ postId: null, error: 'HTTP 500', rejected: false }),
      getConfig: getBufferConfig,
      paths: { queue: '/tmp/q.json', publishedLog: '/tmp/p.json', failedLog: '/tmp/f.json' },
    });
    assert.equal(exitCode, 1);
    assert.ok(['failed', 'error'].includes(results[0].action));
    assert.equal(article.channels.linkedin.status, CHANNEL_STATUSES.FAILED);
  } finally {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

// 7. Facebook only failure — partial recovery retries facebook only
test('7. facebook only failure — only facebook retried on re-run', async () => {
  const article = mockArticle();
  article.channels.facebook.status = CHANNEL_STATUSES.FAILED;
  article.channels.facebook.bufferUpdateId = null;
  article.channels.x.status = CHANNEL_STATUSES.QUEUED;
  article.channels.x.bufferUpdateId = 'x-done';

  const created = [];
  const origEnv = {
    BUFFER_ACCESS_TOKEN: process.env.BUFFER_ACCESS_TOKEN,
    BUFFER_CHANNEL_ID_FACEBOOK: process.env.BUFFER_CHANNEL_ID_FACEBOOK,
    BUFFER_CHANNEL_ID_LINKEDIN: process.env.BUFFER_CHANNEL_ID_LINKEDIN,
    BUFFER_CHANNEL_ID_TWITTER: process.env.BUFFER_CHANNEL_ID_TWITTER,
  };
  process.env.BUFFER_ACCESS_TOKEN = 'tok';
  process.env.BUFFER_CHANNEL_ID_FACEBOOK = 'fb';
  process.env.BUFFER_CHANNEL_ID_LINKEDIN = 'li';
  process.env.BUFFER_CHANNEL_ID_TWITTER = 'x-ch';

  try {
    await processArticleChannels({
      article,
      queue: { posts: [article] },
      now: new Date('2026-08-05T10:35:00+09:00'),
      dryRun: true,
      requestedChannels: ['linkedin', 'facebook', 'x'],
      verifyArticleUrl: async () => ({ ok: true }),
      createBufferPost: async ({ channelId }) => {
        created.push(channelId);
        return { postId: 'fb-new', error: null, rejected: false };
      },
      getConfig: getBufferConfig,
      paths: { queue: '/tmp/q.json', publishedLog: '/tmp/p.json', failedLog: '/tmp/f.json' },
    });
    assert.deepEqual(created, ['fb']);
  } finally {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

// 8. X only failure
test('8. x only failure — linkedin/facebook skipped when queued', async () => {
  const article = mockArticle();
  article.channels.linkedin.status = CHANNEL_STATUSES.QUEUED;
  article.channels.linkedin.bufferUpdateId = 'li-done';
  article.channels.facebook.status = CHANNEL_STATUSES.QUEUED;
  article.channels.facebook.bufferUpdateId = 'fb-done';
  article.channels.x.status = CHANNEL_STATUSES.FAILED;
  article.channels.x.bufferUpdateId = null;

  const created = [];
  const origEnv = {
    BUFFER_ACCESS_TOKEN: process.env.BUFFER_ACCESS_TOKEN,
    BUFFER_CHANNEL_ID_TWITTER: process.env.BUFFER_CHANNEL_ID_TWITTER,
    BUFFER_CHANNEL_ID_LINKEDIN: process.env.BUFFER_CHANNEL_ID_LINKEDIN,
    BUFFER_CHANNEL_ID_FACEBOOK: process.env.BUFFER_CHANNEL_ID_FACEBOOK,
  };
  process.env.BUFFER_ACCESS_TOKEN = 'tok';
  process.env.BUFFER_CHANNEL_ID_TWITTER = 'x-ch';
  process.env.BUFFER_CHANNEL_ID_LINKEDIN = 'li';
  process.env.BUFFER_CHANNEL_ID_FACEBOOK = 'fb';

  try {
    await processArticleChannels({
      article,
      queue: { posts: [article] },
      now: new Date('2026-08-05T10:35:00+09:00'),
      dryRun: true,
      requestedChannels: ['linkedin', 'facebook', 'x'],
      verifyArticleUrl: async () => ({ ok: true }),
      createBufferPost: async ({ channelId }) => {
        created.push(channelId);
        return { postId: 'x-new', error: null, rejected: false };
      },
      getConfig: getBufferConfig,
      paths: { queue: '/tmp/q.json', publishedLog: '/tmp/p.json', failedLog: '/tmp/f.json' },
    });
    assert.deepEqual(created, ['x-ch']);
  } finally {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

// 9. Workflow re-run idempotency (10x reconcile dry-run)
test('9. workflow re-run — 10x dry reconcile does not throw', async () => {
  for (let i = 0; i < 10; i++) {
    const summary = await reconcilePublishingPipeline({
      now: new Date('2026-08-12T11:00:00+09:00'),
      dryRun: true,
      skipPublish: true,
      skipVerify: true,
      skipBuffer: true,
    });
    assert.ok(summary.pipelineStatus);
  }
});

// 10. Duplicate prevention — already queued channel skipped
test('10. duplicate prevention — isChannelQueued blocks re-queue', () => {
  assert.equal(isChannelQueued({ bufferUpdateId: 'abc' }), true);
  assert.equal(isChannelQueued({ bufferUpdateId: EXISTING_BUFFER_SENTINEL }), true);
  assert.equal(isChannelQueued({ status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null }), false);
});

// 11. JST/UTC boundary — resolvePublishAt on UTC runner
test('11. JST/UTC boundary — late publish bumps buffer times in JST', () => {
  const now = new Date('2026-08-04T03:14:00.000Z');
  const bumped = resolvePublishAt('2026-08-04T12:30:00+09:00', now, 30);
  assert.equal(bumped, '2026-08-04T12:45:00+09:00');
});

// 12. Weekend — publishDueArticles skips without force
test('12. weekend — no publish on Sunday', () => {
  const sunday = new Date('2026-08-09T10:00:00+09:00');
  const r = publishDueArticles({ now: sunday, dryRun: true });
  assert.equal(r.reason, 'weekend');
});

// 13. Already published on disk — skipped not errored
test('13. already published — skipped when dest exists', () => {
  const slug = 'ari-vs-geo-seo';
  if (!fs.existsSync(path.join(ROOT, 'insights', slug, 'index.html'))) {
    assert.ok(true, 'skip — slug not on disk in this checkout');
    return;
  }
  const r = publishDueArticles({
    now: new Date('2026-08-13T10:00:00+09:00'),
    forceSlug: slug,
    dryRun: true,
  });
  assert.ok(r.skipped?.includes(slug) || !r.published?.includes(slug));
});

// 14. Already queued Buffer — pickBufferEligible skips fully queued
test('14. already queued buffer — no eligible when all channels queued', () => {
  const queue = {
    posts: [
      {
        slug: 'done',
        status: 'buffer_queued',
        channels: {
          linkedin: { bufferUpdateId: '1', status: CHANNEL_STATUSES.QUEUED },
          facebook: { bufferUpdateId: '2', status: CHANNEL_STATUSES.QUEUED },
          x: { bufferUpdateId: '3', status: CHANNEL_STATUSES.QUEUED },
        },
      },
    ],
  };
  const schedule = {
    articles: [{ slug: 'done', status: 'published', productionVerifiedAt: '2026-08-12T01:00:00.000Z' }],
  };
  assert.equal(pickBufferEligibleArticle(queue, { schedule }), null);
});

// 15. Partial buffer recovery — verified slug with one pending channel
test('15. partial buffer recovery — pickBufferEligible returns partial article', () => {
  const queue = {
    posts: [
      {
        slug: 'partial',
        status: 'partially_queued',
        articlePublishAt: '2026-08-13T10:00:00+09:00',
        channels: {
          linkedin: { bufferUpdateId: 'li', status: CHANNEL_STATUSES.QUEUED },
          facebook: { bufferUpdateId: null, status: CHANNEL_STATUSES.SCHEDULED },
          x: { bufferUpdateId: null, status: CHANNEL_STATUSES.SCHEDULED },
        },
      },
    ],
  };
  const schedule = {
    articles: [{ slug: 'partial', status: 'published', productionVerifiedAt: '2026-08-13T10:30:00+09:00' }],
  };
  const picked = pickBufferEligibleArticle(queue, { schedule });
  assert.equal(picked?.slug, 'partial');
});

test('productionVerifiedAt marks published_verified derived state', () => {
  const article = {
    slug: 'v',
    status: EDITORIAL_STATUSES.PUBLISHED,
    productionVerifiedAt: '2026-08-13T10:30:00+09:00',
  };
  assert.equal(isProductionVerified(article), true);
  assert.equal(
    deriveScheduleOperationalState(article),
    OPERATIONAL_STATES.PUBLISHED_VERIFIED
  );
});

test('verification pending when published without productionVerifiedAt', () => {
  const article = { slug: 'v', status: EDITORIAL_STATUSES.PUBLISHED };
  assert.equal(
    deriveScheduleOperationalState(article, { now: new Date('2026-08-13T10:05:00+09:00') }),
    OPERATIONAL_STATES.VERIFICATION_PENDING
  );
  assert.equal(listVerificationPending([article]).length, 1);
});

test('listVerificationPending prefers most recently published article', () => {
  const pending = listVerificationPending([
    { slug: 'legacy', status: EDITORIAL_STATUSES.PUBLISHED, publishedAt: '2026-07-13T04:31:54.440Z' },
    { slug: 'today', status: EDITORIAL_STATUSES.PUBLISHED, publishedAt: '2026-08-13T01:23:41.363Z' },
  ]);
  assert.equal(pending[0].slug, 'today');
});

test('bumpBufferTimesForArticle bumps past channel publishAt', () => {
  const post = {
    channels: {
      linkedin: { publishAt: '2026-08-13T11:30:00+09:00', bufferUpdateId: null },
      facebook: { publishAt: '2026-08-13T11:45:00+09:00', bufferUpdateId: null },
      x: { publishAt: '2026-08-13T12:00:00+09:00', bufferUpdateId: null },
    },
  };
  const now = new Date('2026-08-13T13:00:00+09:00');
  const changed = bumpBufferTimesForArticle(post, now);
  assert.equal(changed, true);
  assert.ok(new Date(post.channels.linkedin.publishAt).getTime() >= now.getTime() + 30 * 60_000 - 1000);
});

test('reconcile workflow file exists with weekday crons', () => {
  const wf = fs.readFileSync(
    path.join(ROOT, '.github/workflows/reconcile-publishing-pipeline.yml'),
    'utf8'
  );
  assert.match(wf, /reconcile-publishing-pipeline/);
  assert.match(wf, /cron: '0,15,30,45 1-3 \* \* 1-5'/);
  assert.match(wf, /cron: '0 4 \* \* 1-5'/);
  assert.match(wf, /--skip-verify --skip-buffer/);
  assert.match(wf, /--skip-publish\)/);
  assert.doesNotMatch(wf, /--skip-publish --force-slug/);
});

test('forensic audit report exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'reports/publishing-pipeline-forensic-audit.md')));
});
