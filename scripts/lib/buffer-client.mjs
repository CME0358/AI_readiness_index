/**
 * Buffer GraphQL client — pattern from upload_buffer_drafts.py (QOL project).
 * Uses BUFFER_ACCESS_TOKEN + per-channel BUFFER_CHANNEL_ID_* env vars.
 */

import { CHANNEL_ENV, LEGACY_CHANNEL_ENV } from './social-channels.mjs';
import { toBufferDueAt, isScheduleInstantInFuture } from './social-schedule.mjs';

const BUFFER_API = 'https://api.buffer.com';

const CREATE_POST_MUTATION = `
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess {
      post { id status text }
    }
    ... on MutationError {
      message
    }
  }
}
`;

export function getBufferConfig() {
  const legacy = process.env[LEGACY_CHANNEL_ENV]?.trim() || '';
  return {
    accessToken: process.env.BUFFER_ACCESS_TOKEN?.trim() || '',
    channelId: legacy,
    organizationId: process.env.BUFFER_ORGANIZATION_ID?.trim() || '',
    linkedinProfileId: process.env.BUFFER_LINKEDIN_PROFILE_ID?.trim() || '',
    channelIds: {
      linkedin: process.env[CHANNEL_ENV.linkedin]?.trim() || legacy,
      facebook: process.env[CHANNEL_ENV.facebook]?.trim() || '',
      x: process.env[CHANNEL_ENV.x]?.trim() || '',
    },
  };
}

/** Resolve channel ID — per-channel env first, legacy BUFFER_CHANNEL_ID for LinkedIn only */
export function getChannelId(channelKey, cfg = getBufferConfig()) {
  const envName = CHANNEL_ENV[channelKey];
  if (!envName) return '';
  const specific = process.env[envName]?.trim();
  if (specific) return specific;
  if (channelKey === 'linkedin' && cfg.channelId) return cfg.channelId;
  return '';
}

export function isChannelConfigured(channelKey, cfg = getBufferConfig()) {
  return Boolean(cfg.accessToken && getChannelId(channelKey, cfg));
}

export function isBufferConfigured(cfg = getBufferConfig()) {
  return Boolean(cfg.accessToken && (cfg.channelId || cfg.channelIds.linkedin));
}

export function isRateLimitError(message) {
  if (!message) return false;
  const e = message.toUpperCase();
  return e.includes('429') || e.includes('RATE') || e.includes('TOO MANY');
}

export function isQueueLimitError(message) {
  if (!message) return false;
  const e = message.toLowerCase();
  return (
    e.includes('limit') ||
    e.includes('quota') ||
    e.includes('maximum') ||
    e.includes('10') ||
    e.includes('queue is full')
  );
}

export async function bufferGraphql(accessToken, query, variables, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Build GraphQL CreatePostInput with per-channel metadata (Buffer schema). */
export function buildCreatePostInput({ channelKey, channelId, text, dueAtUtc }) {
  const input = {
    channelId,
    text,
    schedulingType: 'automatic',
    saveToDraft: false,
    mode: dueAtUtc ? 'customScheduled' : 'addToQueue',
    assets: [],
  };
  if (dueAtUtc) input.dueAt = dueAtUtc;

  // Facebook requires metadata.facebook.type (post | story | reel)
  if (channelKey === 'facebook') {
    input.metadata = { facebook: { type: 'post' } };
  }

  return input;
}

function mutationErrorMessage(result) {
  if (!result) return 'Unknown Buffer response';
  if (typeof result.message === 'string') return result.message;
  return JSON.stringify(result).slice(0, 500);
}

/**
 * @returns {Promise<{postId: string|null, error: string|null, rejected: boolean, dueAtUtc?: string|null}>}
 */
export async function createBufferPost({
  channelKey = null,
  channelId,
  accessToken,
  text,
  dueAt,
  dryRun = false,
}) {
  if (dryRun) {
    const dueAtUtc = dueAt ? toBufferDueAt(dueAt) : null;
    return { postId: 'dry-run-mock-id', error: null, rejected: false, dueAtUtc };
  }

  let dueAtUtc = null;
  if (dueAt) {
    dueAtUtc = toBufferDueAt(dueAt);
    if (!isScheduleInstantInFuture(dueAtUtc)) {
      return {
        postId: null,
        error: `Invalid post input: dueAt must be in the future (got ${dueAtUtc}, now ${new Date().toISOString()})`,
        rejected: false,
        dueAtUtc,
      };
    }
  }

  const input = buildCreatePostInput({ channelKey, channelId, text, dueAtUtc });

  const data = await bufferGraphql(accessToken, CREATE_POST_MUTATION, { input });
  if (data.errors?.length) {
    const msg = JSON.stringify(data.errors);
    return { postId: null, error: msg, rejected: isQueueLimitError(msg), dueAtUtc };
  }

  const result = data.data?.createPost;
  if (result?.__typename === 'PostActionSuccess') {
    return { postId: result.post?.id || null, error: null, rejected: false, dueAtUtc };
  }
  if (result?.__typename === 'InvalidInputError' || result?.__typename === 'UnexpectedError') {
    const msg = mutationErrorMessage(result);
    return { postId: null, error: msg, rejected: isQueueLimitError(msg), dueAtUtc };
  }
  if (result?.__typename === 'MutationError') {
    const msg = mutationErrorMessage(result);
    return { postId: null, error: msg, rejected: isQueueLimitError(msg), dueAtUtc };
  }
  return {
    postId: null,
    error: mutationErrorMessage(result),
    rejected: false,
    dueAtUtc,
  };
}
