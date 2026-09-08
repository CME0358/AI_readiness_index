/**
 * Detect and remove unauthorized empty Buffer drafts / placeholder posts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './insights-v2-paths.mjs';
import { bufferGraphql, getBufferConfig, getChannelId } from './buffer-client.mjs';

const CHANNELS = ['linkedin', 'facebook', 'x'];
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function slugFromText(text = '') {
  const match = text.match(/https?:\/\/[^\s)]+\/insights\/([^/?#\s]+)\/?/i);
  return match?.[1] || null;
}

function extractHttpsUrl(text = '') {
  return text.match(/https:\/\/[^\s)<>]+/i)?.[0]?.replace(/[.,;!?]+$/, '') || null;
}

async function fetchChannelPosts({ accessToken, organizationId, channelId, graphql = bufferGraphql, maxPages = MAX_PAGES }) {
  const query = `query FutureBufferPosts($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) {
    posts(first: ${PAGE_SIZE}, after: $after, input: {
      organizationId: $organizationId
      filter: { channelIds: [$channelId] }
    }) {
      edges { node { id text status dueAt channelId createdAt } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const posts = [];
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
      posts.push(node);
    }
    if (!connection.pageInfo.hasNextPage) return posts;
    after = connection.pageInfo.endCursor;
    if (!after) throw new Error('pagination next page missing endCursor');
  }
}

const CANONICAL_SLOT = Object.freeze({
  linkedin: '11:30',
  facebook: '11:45',
  x: '12:00',
});
const MIN_TEXT_LEN = 20;

function readJson(relative, fallback) {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function jstHm(value) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function isCanonicalSlotTime(channel, dueAt) {
  const expected = CANONICAL_SLOT[channel];
  return Boolean(expected && jstHm(dueAt) === expected);
}

export function loadProtectedPostIds({ root = ROOT } = {}) {
  const ids = new Set();
  const queue = readJson('insights/_social/buffer/queue.json', { posts: [] });
  for (const post of queue.posts || []) {
    for (const channel of CHANNELS) {
      const id = post.channels?.[channel]?.bufferUpdateId;
      if (id && id !== 'existing-in-buffer') ids.add(id);
    }
  }
  const ledger = readJson('insights/_social/x-sidecar/ledger.json', { posts: [] });
  for (const entry of ledger.posts || []) {
    if (entry.buffer_post_id) ids.add(entry.buffer_post_id);
  }
  return ids;
}

export function classifyRemovableDraft(post, channel, { now = new Date(), protectedIds = new Set() } = {}) {
  if (!post?.id) return { remove: false, reason: 'missing_id' };
  if (protectedIds.has(post.id)) return { remove: false, reason: 'protected_ledger_id' };
  if (post.status === 'sent') return { remove: false, reason: 'already_sent' };

  const text = String(post.text || '').trim();
  const due = post.dueAt ? new Date(post.dueAt) : null;
  const isFuture = due ? due.getTime() > now.getTime() : true;
  const hasInsightsUrl = /readiness\.coaretail\.com\/insights\//i.test(text);
  const hasGoUrl = /readiness\.coaretail\.com\/go\//i.test(text);
  const canonicalSlot = isCanonicalSlotTime(channel, post.dueAt);
  const emptyish = text.length < MIN_TEXT_LEN;
  const isDraft = post.status === 'draft' || post.status === 'needs_approval';

  if (isDraft && (emptyish || !hasInsightsUrl)) {
    return { remove: true, reason: 'draft_empty_or_placeholder', channel, id: post.id };
  }
  if (isFuture && emptyish && !hasInsightsUrl && !hasGoUrl) {
    return { remove: true, reason: 'future_empty_placeholder', channel, id: post.id };
  }
  if (isFuture && !canonicalSlot && emptyish) {
    return { remove: true, reason: 'off_schedule_empty', channel, id: post.id };
  }
  if (isFuture && !canonicalSlot && !hasInsightsUrl && !hasGoUrl && isDraft) {
    return { remove: true, reason: 'off_schedule_unauthorized_draft', channel, id: post.id };
  }
  return {
    remove: false,
    reason: 'keep',
    channel,
    id: post.id,
    status: post.status,
    slot: jstHm(post.dueAt),
    textLen: text.length,
    slug: slugFromText(text),
    url: extractHttpsUrl(text),
  };
}

export async function fetchDraftContentItems({ accessToken, organizationId, graphql = bufferGraphql } = {}) {
  const query = `query DraftContentItems($organizationId: OrganizationId!, $after: String) {
    contentItems(first: 50, after: $after, input: {
      organizationId: $organizationId
      filter: { contentStatus: draftContent }
    }) {
      totalCount
      edges { node { id title targetDate createdAt body { ... on DraftContent { text } } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const items = [];
  let after = null;
  while (true) {
    const response = await graphql(accessToken, query, { organizationId, after });
    const connection = response.data?.contentItems;
    if (response.errors?.length || !connection) throw new Error('contentItems query failed');
    for (const edge of connection.edges || []) {
      if (edge?.node) items.push(edge.node);
    }
    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor;
    if (!after) break;
  }
  return items;
}

export async function deleteBufferPost({ accessToken, postId, graphql = bufferGraphql, dryRun = false } = {}) {
  if (dryRun) return { ok: true, id: postId, dryRun: true };
  const mutation = `mutation DeletePost($input: DeletePostInput!) {
    deletePost(input: $input) {
      __typename
      ... on DeletePostSuccess { id }
      ... on VoidMutationError { message }
    }
  }`;
  const data = await graphql(accessToken, mutation, { input: { id: postId } });
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors));
  const result = data.data?.deletePost;
  if (result?.__typename === 'DeletePostSuccess') return { ok: true, id: result.id };
  throw new Error(result?.message || 'deletePost failed');
}

export async function deleteContentItem({ accessToken, contentItemId, graphql = bufferGraphql, dryRun = false } = {}) {
  if (dryRun) return { ok: true, id: contentItemId, dryRun: true };
  const mutation = `mutation DeleteContentItem($input: DeleteContentItemInput!) {
    deleteContentItem(input: $input) {
      __typename
      ... on EmptySuccess { _empty }
      ... on DeleteContentItemFailure { message errors { message } }
    }
  }`;
  const data = await graphql(accessToken, mutation, { input: { id: contentItemId } });
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors));
  const result = data.data?.deleteContentItem;
  if (result?.__typename === 'EmptySuccess') return { ok: true, id: contentItemId };
  throw new Error(result?.message || 'deleteContentItem failed');
}

export async function findRemovableDrafts({
  now = new Date(),
  cfg = getBufferConfig(),
  graphql = bufferGraphql,
  protectedIds = loadProtectedPostIds(),
} = {}) {
  const removable = [];
  const kept = [];
  for (const channel of CHANNELS) {
    const channelId = getChannelId(channel, cfg);
    if (!channelId) continue;
    const remote = await fetchChannelPosts({
      accessToken: cfg.accessToken,
      organizationId: cfg.organizationId,
      channelId,
      graphql,
    });
    for (const post of remote) {
      const verdict = classifyRemovableDraft(post, channel, { now, protectedIds });
      if (verdict.remove) removable.push({ ...verdict, dueAt: post.dueAt, status: post.status, textPreview: String(post.text || '').slice(0, 80) });
      else if (post.dueAt && new Date(post.dueAt) > now) kept.push(verdict);
    }
  }
  return { removable, kept, protectedIds: [...protectedIds] };
}

export async function cleanupBufferEmptyDrafts({
  now = new Date(),
  cfg = getBufferConfig(),
  graphql = bufferGraphql,
  dryRun = false,
} = {}) {
  const protectedIds = loadProtectedPostIds();
  const { removable, kept } = await findRemovableDrafts({ now, cfg, graphql, protectedIds });

  const contentItems = await fetchDraftContentItems({
    accessToken: cfg.accessToken,
    organizationId: cfg.organizationId,
    graphql,
  }).catch(() => []);

  const removableContentItems = contentItems.filter((item) => {
    const text = String(item.body?.text || '').trim();
    return text.length < MIN_TEXT_LEN;
  });

  const deletedPosts = [];
  for (const item of removable) {
    const result = await deleteBufferPost({ accessToken: cfg.accessToken, postId: item.id, graphql, dryRun });
    deletedPosts.push({ ...item, result });
  }

  const deletedContentItems = [];
  for (const item of removableContentItems) {
    const result = await deleteContentItem({ accessToken: cfg.accessToken, contentItemId: item.id, graphql, dryRun });
    deletedContentItems.push({ id: item.id, title: item.title, targetDate: item.targetDate, result });
  }

  return {
    generatedAt: now.toISOString(),
    dryRun,
    deletedPosts,
    deletedContentItems,
    keptFuturePosts: kept.length,
    scannedRemovable: removable.length,
    scannedContentItems: contentItems.length,
  };
}
