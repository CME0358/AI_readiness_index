#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bufferGraphql, getBufferConfig, getChannelId } from './lib/buffer-client.mjs';
import { loadCanonicalBufferEnv } from './lib/buffer-env.mjs';

const ROOT = process.cwd();
const CHANNELS = [
  ['x', 'BUFFER_CHANNEL_ID_TWITTER'],
  ['linkedin', 'BUFFER_CHANNEL_ID_LINKEDIN'],
  ['facebook', 'BUFFER_CHANNEL_ID_FACEBOOK'],
];
const PROTECTED = new Map([
  ['2026-09-08|exec-readiness-kpi', 'LOCAL_AUTHORIZED'],
  ['2026-09-14|openai-product-discovery-agentic-commerce', 'PHASE_9G_PROTECTED'],
  ['2026-09-15|competitors-visible-company-missing', 'PHASE_9G_PROTECTED'],
  ['2026-09-16|execution-readiness', 'PHASE_9G_PROTECTED'],
  ['2026-09-17|html-observation-check-limits', 'PHASE_9G_PROTECTED'],
  ['2026-09-18|seo-meo-ai-recommendation-gap', 'PHASE_9G_PROTECTED'],
]);
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function readJson(relative, fallback) {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function jstDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function extractHttpsUrl(text = '') {
  return text.match(/https:\/\/[^\s)<>]+/i)?.[0]?.replace(/[.,;!?]+$/, '') || null;
}

export function slugFromText(text = '') {
  const match = text.match(/https?:\/\/[^\s)]+\/insights\/([^/?#\s]+)\/?/i);
  return match?.[1] || null;
}

function normalizeText(text = '') {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function localAuthority() {
  const schedule = readJson('insights/_scheduled/schedule.json', { articles: [] });
  const queue = readJson('insights/_social/buffer/queue.json', { posts: [] });
  const holds = new Set(schedule.articles.filter((a) => a.status === 'editorial_hold').map((a) => a.slug));
  const authorized = new Map();

  for (const article of schedule.articles) {
    if (!article.slug || !article.publishAt || !['scheduled', 'published'].includes(article.status)) continue;
    const date = jstDate(article.publishAt);
    const key = `${date}|${article.slug}`;
    for (const channel of ['x', 'linkedin', 'facebook']) authorized.set(`${key}|${channel}`, { source: 'schedule', article });
  }
  for (const post of queue.posts || []) {
    if (!post.slug || !post.articlePublishAt || post.status === 'editorial_hold') continue;
    const date = jstDate(post.articlePublishAt);
    for (const channel of ['x', 'linkedin', 'facebook']) {
      if (post.channels?.[channel]?.publishAt) authorized.set(`${date}|${post.slug}|${channel}`, { source: 'buffer-ledger', post });
    }
  }
  return { authorized, holds };
}

export async function fetchChannelPosts({ accessToken, organizationId, channelId, graphql = bufferGraphql, maxPages = MAX_PAGES }) {
  const query = `query FutureBufferPosts($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) {
    posts(first: ${PAGE_SIZE}, after: $after, input: {
      organizationId: $organizationId
      filter: { channelIds: [$channelId] }
    }) {
      edges { node { id text status dueAt channelId createdAt assets { source } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const posts = [];
  const seenCursors = new Set();
  let after = null;
  let pageIndex = 0;

  while (true) {
    pageIndex += 1;
    if (pageIndex > maxPages) throw new Error(`pagination exceeded max pages (${maxPages})`);
    const response = await graphql(accessToken, query, { organizationId, channelId, after });
    const connection = response.data?.posts;
    if (response.errors?.length || !connection?.edges || !connection.pageInfo) throw new Error('remote query failed');
    for (const edge of connection.edges) {
      const node = edge?.node;
      if (!node) continue;
      if (node.channelId && node.channelId !== channelId) {
        throw new Error(`channel mismatch: requested ${channelId}, returned ${node.channelId}`);
      }
      posts.push({ ...node, page_index: pageIndex, retrieved_channel_id: node.channelId || null });
    }
    if (!connection.pageInfo.hasNextPage) return posts;
    const nextCursor = connection.pageInfo.endCursor;
    if (!nextCursor) throw new Error('pagination next page missing endCursor');
    if (seenCursors.has(nextCursor)) throw new Error(`pagination cursor repeated: ${nextCursor}`);
    seenCursors.add(nextCursor);
    after = nextCursor;
  }
}

export function classify(post, channel, authority) {
  const slug = slugFromText(post.text);
  const date = post.dueAt ? jstDate(post.dueAt) : null;
  const key = slug && date ? `${date}|${slug}` : null;
  const protectedReason = key ? PROTECTED.get(key) : null;
  if (protectedReason) return { classification: 'KEEP', reason: protectedReason };
  if (key && authority.authorized.has(`${key}|${channel}`)) return { classification: 'KEEP', reason: 'AUTHORIZED_CANONICAL' };
  if (slug && authority.holds.has(slug)) return { classification: 'REMOVE_CANDIDATE', reason: 'EDITORIAL_HOLD_LEAK' };
  if (slug) return { classification: 'REMOVE_CANDIDATE', reason: 'NO_CURRENT_PUBLICATION_AUTHORITY' };
  return { classification: 'REVIEW_REQUIRED', reason: 'UNKNOWN_CONTENT_IDENTITY' };
}

export async function runAudit({ now = new Date(), cfg = getBufferConfig(), graphql = bufferGraphql } = {}) {
  if (!cfg.accessToken || !cfg.organizationId) throw new Error('missing Buffer auth configuration');
  const authority = localAuthority();
  const posts = [];
  for (const [channel, envName] of CHANNELS) {
    const channelId = getChannelId(channel, cfg);
    if (!channelId) throw new Error(`missing channel configuration: ${envName}`);
    const remote = await fetchChannelPosts({ accessToken: cfg.accessToken, organizationId: cfg.organizationId, channelId, graphql });
    for (const post of remote) {
      if (!post.dueAt || new Date(post.dueAt) <= now) continue;
      const result = classify(post, channel, authority);
      posts.push({
        remote_post_id: post.id,
        channel,
        channel_id: channelId,
        scheduled_at: post.dueAt,
        scheduled_at_jst: new Date(post.dueAt).toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }),
        status: post.status,
        text_preview: normalizeText(post.text).slice(0, 180),
        target_url: extractHttpsUrl(post.text),
        article_slug: slugFromText(post.text),
        classification: post.retrieved_channel_id ? result.classification : 'REVIEW_REQUIRED',
        reason: post.retrieved_channel_id ? result.reason : 'CHANNEL_ID_UNVERIFIED',
        page_index: post.page_index,
        retrieved_channel_id: post.retrieved_channel_id,
      });
    }
  }
  posts.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at) || a.channel.localeCompare(b.channel) || a.remote_post_id.localeCompare(b.remote_post_id));
  return {
    generated_at: new Date().toISOString(),
    current_jst: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }),
    total: posts.length,
    by_channel: Object.fromEntries(CHANNELS.map(([channel]) => [channel, posts.filter((p) => p.channel === channel).length])),
    counts: Object.fromEntries(['KEEP', 'REMOVE_CANDIDATE', 'REVIEW_REQUIRED'].map((kind) => [kind, posts.filter((p) => p.classification === kind).length])),
    posts,
  };
}

async function main() {
  loadCanonicalBufferEnv();
  const output = await runAudit();
  fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'artifacts/buffer-future-queue-audit.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ total: output.total, by_channel: output.by_channel, counts: output.counts }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('BUFFER_AUDIT_FAILED');
    console.error(error.message);
    process.exit(1);
  });
}
