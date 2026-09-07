import test from 'node:test';
import assert from 'node:assert/strict';
import { processArticleChannels, isBufferDeliveryComplete } from '../lib/buffer-dispatcher.mjs';
import { CHANNEL_STATUSES } from '../lib/social-channels.mjs';

const URL = 'https://readiness.coaretail.com/insights/ai-search-52-percent/';
const paths = {
  queue: '/tmp/ari-incident-queue.json',
  publishedLog: '/tmp/ari-incident-published.json',
  failedLog: '/tmp/ari-incident-failed.json',
};

function article() {
  return {
    slug: 'fixture',
    articleUrl: URL,
    articlePublishAt: '2026-09-07T10:00:00+09:00',
    status: 'partially_queued',
    channels: Object.fromEntries(['linkedin', 'facebook', 'x'].map((channel) => [channel, {
      channelIdEnv: `BUFFER_CHANNEL_ID_${channel === 'x' ? 'TWITTER' : channel.toUpperCase()}`,
      contentFile: `insights/_social/${channel}/posts/ai-search-52-percent.md`,
      publishAt: `2026-09-07T${channel === 'linkedin' ? '11:30' : channel === 'facebook' ? '11:45' : '12:00'}:00+09:00`,
      status: CHANNEL_STATUSES.SCHEDULED,
      bufferUpdateId: null,
    }])),
  };
}

const config = () => ({
  accessToken: 'fixture-token',
  channelIds: { linkedin: 'li', facebook: 'fb', x: 'x' },
});

const verify = async () => ({
  ok: true,
  mediaUrl: 'https://readiness.coaretail.com/assets/insights/fixture/hero.webp',
  mediaStatus: 'canonical_hero_verified',
});

test('A/B/C/H/I: partial delivery is incomplete and retries only missing channels', async () => {
  const post = article();
  const created = [];
  const first = await processArticleChannels({
    article: post,
    queue: { posts: [post] },
    now: new Date('2026-09-07T01:00:00Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyProduction: verify,
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      if (channelKey !== 'x') return { postId: null, error: `${channelKey} failed`, rejected: false };
      return { postId: 'x-existing', error: null, rejected: false };
    },
    getConfig: config,
    paths,
  });
  assert.deepEqual(created, ['linkedin', 'facebook', 'x']);
  assert.equal(first.deliveryComplete, false);
  assert.equal(isBufferDeliveryComplete(post), false);

  created.length = 0;
  const second = await processArticleChannels({
    article: post,
    queue: { posts: [post] },
    now: new Date('2026-09-07T01:05:00Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyProduction: verify,
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      return { postId: `${channelKey}-recovered`, error: null, rejected: false };
    },
    getConfig: config,
    paths,
  });
  assert.deepEqual(created, ['linkedin', 'facebook']);
  assert.equal(second.deliveryComplete, true);
  assert.equal(isBufferDeliveryComplete(post), true);

  created.length = 0;
  const third = await processArticleChannels({
    article: post,
    queue: { posts: [post] },
    now: new Date('2026-09-07T01:10:00Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyProduction: verify,
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      return { postId: `${channelKey}-duplicate`, error: null, rejected: false };
    },
    getConfig: config,
    paths,
  });
  assert.deepEqual(created, []);
  assert.equal(third.deliveryComplete, true);
});

test('D: remote success after ambiguous local state is adopted without create', async () => {
  const post = article();
  const created = [];
  post.channels.linkedin.status = CHANNEL_STATUSES.FAILED;
  const result = await processArticleChannels({
    article: post,
    queue: { posts: [post] },
    now: new Date('2026-09-07T01:15:00Z'),
    dryRun: false,
    requestedChannels: ['linkedin'],
    verifyProduction: verify,
    findExistingBufferPost: async ({ channel }) => channel === 'linkedin' ? { id: 'remote-li' } : null,
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      return { postId: 'must-not-create', error: null, rejected: false };
    },
    getConfig: config,
    paths,
  });
  assert.deepEqual(created, []);
  assert.equal(result.results[0].action, 'reconciled_existing');
  assert.equal(post.channels.linkedin.bufferUpdateId, 'remote-li');
});

test('G: one channel exception does not abort sibling evaluation', async () => {
  const post = article();
  const created = [];
  const result = await processArticleChannels({
    article: post,
    queue: { posts: [post] },
    now: new Date('2026-09-07T01:20:00Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyProduction: verify,
    createBufferPost: async ({ channelKey }) => {
      created.push(channelKey);
      if (channelKey === 'linkedin') throw new Error('timeout');
      return { postId: `${channelKey}-ok`, error: null, rejected: false };
    },
    getConfig: config,
    paths,
  });
  assert.deepEqual(created, ['linkedin', 'facebook', 'x']);
  assert.equal(post.channels.linkedin.status, CHANNEL_STATUSES.FAILED);
  assert.equal(post.channels.facebook.status, CHANNEL_STATUSES.QUEUED);
  assert.equal(post.channels.x.status, CHANNEL_STATUSES.QUEUED);
  assert.equal(result.exitCode, 1);
});
