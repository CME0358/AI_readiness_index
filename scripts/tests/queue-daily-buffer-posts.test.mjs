#!/usr/bin/env node
/**
 * Unit tests for multi-channel Buffer dispatcher.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isChannelQueued,
  isChannelEligible,
  pickTodayArticle,
  validateChannelContent,
  processArticleChannels,
  parseChannelsArg,
} from '../lib/buffer-dispatcher.mjs';
import {
  CHANNEL_STATUSES,
  EXISTING_BUFFER_SENTINEL,
} from '../lib/social-channels.mjs';
import { resolvePublishAt, toBufferDueAt, jstMinutesFromMidnight } from '../lib/social-schedule.mjs';
import {
  getChannelId,
  getBufferConfig,
  buildCreatePostInput,
} from '../lib/buffer-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BUFFER_QUEUE = path.join(ROOT, 'insights/_social/buffer/queue.json');

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

test('parseChannelsArg maps twitter to x', () => {
  assert.deepEqual(parseChannelsArg('facebook,twitter'), ['facebook', 'x']);
});

test('isChannelQueued respects sentinel and bufferUpdateId', () => {
  assert.equal(isChannelQueued({ bufferUpdateId: EXISTING_BUFFER_SENTINEL }), true);
  assert.equal(isChannelQueued({ bufferUpdateId: 'abc123' }), true);
  assert.equal(isChannelQueued({ status: CHANNEL_STATUSES.QUEUED, bufferUpdateId: null }), true);
  assert.equal(isChannelQueued({ status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null }), false);
});

test('resolvePublishAt bumps past times by 30min minimum', () => {
  const now = new Date('2026-08-04T11:45:00+09:00');
  const bumped = resolvePublishAt('2026-08-04T11:45:00+09:00', now, 30);
  assert.ok(new Date(bumped).getTime() >= now.getTime() + 30 * 60_000);
});

test('resolvePublishAt uses JST on UTC runner (GHA 12:14 JST scenario)', () => {
  // GitHub Actions runner: system TZ=UTC, now=03:14Z = 12:14 JST
  const now = new Date('2026-08-04T03:14:00.000Z');
  const fb = resolvePublishAt('2026-08-04T12:30:00+09:00', now, 30);
  assert.equal(fb, '2026-08-04T12:45:00+09:00');
  assert.equal(toBufferDueAt(fb), '2026-08-04T03:45:00.000Z');

  const x = resolvePublishAt('2026-08-04T12:45:00+09:00', now, 30);
  assert.equal(x, '2026-08-04T12:45:00+09:00');
  assert.equal(toBufferDueAt(x), '2026-08-04T03:45:00.000Z');
});

test('toBufferDueAt converts JST schedule to UTC ISO for Buffer API', () => {
  assert.equal(toBufferDueAt('2026-08-04T12:30:00+09:00'), '2026-08-04T03:30:00.000Z');
  assert.equal(toBufferDueAt('2026-08-04T12:45:00+09:00'), '2026-08-04T03:45:00.000Z');
});

test('buildCreatePostInput sets Facebook type post and UTC dueAt', () => {
  const input = buildCreatePostInput({
    channelKey: 'facebook',
    channelId: 'fb-ch',
    text: 'hello',
    dueAtUtc: '2026-08-04T03:30:00.000Z',
  });
  assert.equal(input.dueAt, '2026-08-04T03:30:00.000Z');
  assert.deepEqual(input.metadata, { facebook: { type: 'post' } });
});

test('buildCreatePostInput omits Facebook metadata for X', () => {
  const input = buildCreatePostInput({
    channelKey: 'x',
    channelId: 'x-ch',
    text: 'hello',
    dueAtUtc: '2026-08-04T04:00:00.000Z',
  });
  assert.equal(input.metadata, undefined);
});

test('jstMinutesFromMidnight is TZ-independent', () => {
  const utcRunnerNow = new Date('2026-08-04T03:14:00.000Z');
  assert.equal(jstMinutesFromMidnight(utcRunnerNow), 12 * 60 + 14);
});

test('pickTodayArticle rejects editorial_hold with force-slug', () => {
  const queue = {
    posts: [{ slug: 'hold-slug', status: 'editorial_hold', bufferTransferAt: '2026-08-05T10:30:00+09:00' }],
  };
  const r = pickTodayArticle(queue, '2026-08-05', { forceSlug: 'hold-slug' });
  assert.equal(r.error?.includes('editorial_hold'), true);
});

test('pickTodayArticle returns one article for transfer day', () => {
  const queue = JSON.parse(fs.readFileSync(BUFFER_QUEUE, 'utf8'));
  const initial = queue.posts.find((p) => p.slug === 'ai-search-shift');
  const ymd = initial.bufferTransferAt.slice(0, 10);
  const r = pickTodayArticle(queue, ymd);
  assert.equal(r.article?.slug, 'ai-search-shift');
});

test('validateChannelContent enforces X length', () => {
  const url = 'https://readiness.coaretail.com/insights/test/';
  const okText = `AI検索では比較の主語が移る。候補形成と実行可能性を整える視点が必要です。\n\n${url}\n#AgentReadiness #GEO`;
  const ok = validateChannelContent('x', okText, url);
  assert.equal(ok.ok, true);
  const long = 'x'.repeat(300) + `\n\n${url}\n#AgentReadiness`;
  const bad = validateChannelContent('x', long, url);
  assert.equal(bad.ok, false);
});

test('processArticleChannels skips linkedin when already queued', async () => {
  const article = mockArticle();
  const queue = { posts: [article] };
  const verify = async () => ({ ok: true });
  const create = async () => ({ postId: 'new-id', error: null, rejected: false });

  const { results, updated } = await processArticleChannels({
    article,
    queue,
    now: new Date('2026-08-05T10:35:00+09:00'),
    dryRun: true,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyArticleUrl: verify,
    createBufferPost: create,
    getConfig: () => ({
      accessToken: 'tok',
      channelIds: { linkedin: 'li', facebook: 'fb', x: 'x' },
    }),
    paths: { queue: '/tmp/q.json', publishedLog: '/tmp/p.json', failedLog: '/tmp/f.json' },
  });

  const li = results.find((r) => r.channel === 'linkedin');
  assert.equal(li.action, 'skip');
  assert.equal(li.reason, 'already_queued');
  assert.equal(updated, false);
});

test('processArticleChannels retries only failed channel on re-run', async () => {
  const article = mockArticle();
  article.channels.facebook.status = CHANNEL_STATUSES.FAILED;
  article.channels.facebook.bufferUpdateId = null;
  article.channels.x.status = CHANNEL_STATUSES.QUEUED;
  article.channels.x.bufferUpdateId = 'x-done';

  const queue = { posts: [article] };
  const verify = async () => ({ ok: true });
  const created = [];
  const create = async ({ channelId }) => {
    created.push(channelId);
    return { postId: 'fb-new', error: null, rejected: false };
  };

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
      queue,
      now: new Date('2026-08-05T10:35:00+09:00'),
      dryRun: true,
      requestedChannels: ['linkedin', 'facebook', 'x'],
      verifyArticleUrl: verify,
      createBufferPost: create,
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

test('processArticleChannels blocks all channels on URL 404', async () => {
  const article = mockArticle();
  article.channels.linkedin.bufferUpdateId = null;
  article.channels.linkedin.status = CHANNEL_STATUSES.SCHEDULED;
  const queue = { posts: [article] };
  const verify = async () => ({ ok: false, reason: 'HTTP 404' });
  const create = async () => {
    throw new Error('should not call Buffer');
  };

  const { exitCode, reason } = await processArticleChannels({
    article,
    queue,
    now: new Date('2026-08-05T10:35:00+09:00'),
    dryRun: true,
    requestedChannels: ['facebook', 'x'],
    verifyArticleUrl: verify,
    createBufferPost: create,
    getConfig: getBufferConfig,
    paths: { queue: '/tmp/q.json', publishedLog: '/tmp/p.json', failedLog: '/tmp/f.json' },
  });

  assert.equal(reason, 'url_unavailable');
  assert.equal(exitCode, 0);
});

test('getChannelId prefers per-channel env names', () => {
  const orig = { ...process.env };
  process.env.BUFFER_CHANNEL_ID_LINKEDIN = 'li-specific';
  process.env.BUFFER_CHANNEL_ID = 'legacy';
  assert.equal(getChannelId('linkedin'), 'li-specific');
  process.env = orig;
});

test('buffer queue has 30 posts and linkedin protected for ai-search-shift', () => {
  const q = JSON.parse(fs.readFileSync(BUFFER_QUEUE, 'utf8'));
  assert.equal(q.posts.length, 30);
  assert.equal(q.policy.postsPerTransfer, 1);
  const initial = q.posts.find((p) => p.slug === 'ai-search-shift');
  assert.equal(initial.channels.linkedin.bufferUpdateId, EXISTING_BUFFER_SENTINEL);
  assert.ok(initial.channels.facebook.contentFile.includes('facebook/posts'));
  assert.ok(initial.channels.x.contentFile.includes('x/posts'));
});

test('facebook and x content files exist for all scheduled slugs', () => {
  const q = JSON.parse(fs.readFileSync(BUFFER_QUEUE, 'utf8'));
  for (const p of q.posts) {
    for (const ch of ['facebook', 'x']) {
      const rel = p.channels[ch].contentFile;
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `${p.slug} ${ch}`);
    }
  }
});
