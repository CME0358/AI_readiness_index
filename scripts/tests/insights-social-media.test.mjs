import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreatePostInput } from '../lib/buffer-client.mjs';
import {
  canonicalHeroUrl,
  resolveCanonicalHero,
  verifyProductionSocialAssets,
} from '../lib/insights-social-media.mjs';
import { processArticleChannels } from '../lib/buffer-dispatcher.mjs';
import { CHANNEL_STATUSES } from '../lib/social-channels.mjs';

const slug = 'ai-search-shift';
const heroUrl = canonicalHeroUrl(slug);

test('Buffer image input uses the stable canonical public hero URL', () => {
  const input = buildCreatePostInput({
    channelKey: 'linkedin',
    channelId: 'li',
    text: 'hello',
    dueAtUtc: null,
    mediaUrl: heroUrl,
  });
  assert.deepEqual(input.assets, [{ image: { url: heroUrl } }]);
});

test('social media policy does not require a derivative when canonical hero exists', () => {
  const source = resolveCanonicalHero(slug);
  assert.equal(source.available, true);
  assert.equal(source.derivativeRequired, false);
  assert.equal(source.publicUrl, heroUrl);
});

test('production gate verifies article metadata and hero URL', async () => {
  const html = [
    `<meta property="og:image" content="${heroUrl}">`,
    `<meta name="twitter:image" content="${heroUrl}">`,
    `<img src="${heroUrl}">`,
  ].join('');
  const result = await verifyProductionSocialAssets(slug, {
    verifyArticle: async () => ({ ok: true, status: 200, html }),
    fetchFn: async () => ({ status: 200 }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.mediaUrl, heroUrl);
  assert.equal(result.derivativeRequired, false);
});

test('hero HTTP failure blocks every channel before Buffer handoff', async () => {
  const article = {
    slug,
    articleUrl: `https://readiness.coaretail.com/insights/${slug}/`,
    channels: {
      linkedin: { status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null },
      facebook: { status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null },
      x: { status: CHANNEL_STATUSES.SCHEDULED, bufferUpdateId: null },
    },
  };
  let calls = 0;
  const result = await processArticleChannels({
    article,
    queue: { posts: [article] },
    now: new Date('2026-08-25T01:00:00.000Z'),
    dryRun: true,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyArticleUrl: async () => ({ ok: true }),
    verifyProduction: async () => ({ ok: false, reason: 'hero_http_404' }),
    createBufferPost: async () => { calls += 1; return { postId: 'bad' }; },
    getConfig: () => ({ accessToken: 'token', channelIds: { linkedin: 'li', facebook: 'fb', x: 'x' } }),
    paths: { queue: '/tmp/q.json', publishedLog: '/tmp/p.json', failedLog: '/tmp/f.json' },
  });
  assert.equal(result.reason, 'hero_http_404');
  assert.equal(calls, 0);
});

test('missing local hero blocks handoff while retaining a retryable pending state', async () => {
  const result = await verifyProductionSocialAssets('missing-test-hero', {
    root: '/private/tmp/ari-no-such-root',
    verifyArticle: async () => ({ ok: true, status: 200 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'hero_missing');
  assert.equal(result.mediaUrl, null);
  assert.equal(result.mediaStatus, 'hero_missing');
});

test('missing hero keeps Buffer channels retryable and makes no createPost calls', async () => {
  const article = {
    slug: 'pending-hero-test',
    articleUrl: 'https://readiness.coaretail.com/insights/pending-hero-test/',
    status: 'scheduled',
    channels: Object.fromEntries(['linkedin', 'facebook', 'x'].map((channel) => [channel, {
      status: CHANNEL_STATUSES.SCHEDULED,
      bufferUpdateId: null,
      channelIdEnv: `BUFFER_CHANNEL_ID_${channel.toUpperCase()}`,
    }])),
  };
  const queue = { posts: [article] };
  let calls = 0;
  const result = await processArticleChannels({
    article,
    queue,
    now: new Date('2026-09-01T03:00:00.000Z'),
    dryRun: false,
    requestedChannels: ['linkedin', 'facebook', 'x'],
    verifyArticleUrl: async () => ({ ok: true, status: 200 }),
    verifyProduction: async () => verifyProductionSocialAssets('missing-test-hero', {
      root: '/private/tmp/ari-no-such-root',
      verifyArticle: async () => ({ ok: true, status: 200 }),
    }),
    createBufferPost: async () => { calls += 1; return { postId: 'unexpected' }; },
    getConfig: () => ({ accessToken: 'token', channelIds: { linkedin: 'li', facebook: 'fb', x: 'x' } }),
    paths: {
      queue: '/private/tmp/ari-buffer-pending-test-queue.json',
      publishedLog: '/private/tmp/ari-buffer-pending-test-published.jsonl',
      failedLog: '/private/tmp/ari-buffer-pending-test-failed.jsonl',
    },
  });
  assert.equal(result.reason, 'hero_missing');
  assert.equal(calls, 0);
  assert.equal(article.status, 'article_url_unavailable');
  assert.deepEqual(
    Object.values(article.channels).map((channel) => channel.status),
    [CHANNEL_STATUSES.URL_UNAVAILABLE, CHANNEL_STATUSES.URL_UNAVAILABLE, CHANNEL_STATUSES.URL_UNAVAILABLE],
  );
});
