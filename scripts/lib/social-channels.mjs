/**
 * Multi-channel social posting constants for Agent Readiness Insights v2.
 */

export const CHANNEL_KEYS = ['linkedin', 'facebook', 'x'];

export const CHANNEL_ENV = {
  linkedin: 'BUFFER_CHANNEL_ID_LINKEDIN',
  facebook: 'BUFFER_CHANNEL_ID_FACEBOOK',
  x: 'BUFFER_CHANNEL_ID_TWITTER',
};

/** Fallback when per-channel env is unset */
export const LEGACY_CHANNEL_ENV = 'BUFFER_CHANNEL_ID';

/** Normal weekday publish times (JST HH:MM) — after Web 10:00 */
export const NORMAL_PUBLISH_TIMES = {
  linkedin: '11:30',
  facebook: '11:45',
  x: '12:00',
};

export const NORMAL_WEB_PUBLISH = '10:00';
export const NORMAL_BUFFER_TRANSFER = '10:30';

export const CONTENT_LIMITS = {
  linkedin: { min: 450, max: 900, hashtags: [2, 5] },
  facebook: { min: 300, max: 650, hashtags: [1, 3] },
  x: { min: 80, max: 250, hashtags: [1, 2] },
};

export const CHANNEL_CONTENT_DIRS = {
  linkedin: 'insights/_social/linkedin/posts',
  facebook: 'insights/_social/facebook/posts',
  x: 'insights/_social/x/posts',
};

export const CHANNEL_STATUSES = {
  SCHEDULED: 'scheduled',
  ARTICLE_PUBLISHED: 'article_published',
  READY: 'ready_for_buffer',
  QUEUED: 'buffer_queued',
  FAILED: 'buffer_transfer_failed',
  REJECTED: 'buffer_rejected',
  SKIPPED: 'skipped',
  MANUAL: 'manual_review',
  URL_UNAVAILABLE: 'article_url_unavailable',
};

/** Sentinel — LinkedIn already registered in Buffer before multi-channel migration */
export const EXISTING_BUFFER_SENTINEL = 'pre-existing-buffer-post';

export function parseChannelsArg(raw) {
  if (!raw || raw === 'all') return [...CHANNEL_KEYS];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((c) => (c === 'twitter' ? 'x' : c));
}

export function validateChannelKeys(keys) {
  for (const k of keys) {
    if (!CHANNEL_KEYS.includes(k)) {
      throw new Error(`Unknown channel: ${k}. Use linkedin,facebook,x`);
    }
  }
}
