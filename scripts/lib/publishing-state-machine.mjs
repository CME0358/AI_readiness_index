/**
 * Operational state machine for Agent Readiness Insights publishing pipeline.
 * Compatible with existing schedule.json / buffer queue — no status migration required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT } from './insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import { CHANNEL_KEYS } from './social-channels.mjs';
import { isChannelQueued, isChannelEligible } from './buffer-dispatcher.mjs';

export const OPERATIONAL_STATES = {
  EDITORIAL_HOLD: 'editorial_hold',
  SCHEDULED: 'scheduled',
  PUBLISH_DUE: 'publish_due',
  PUBLISHED: 'published',
  VERIFICATION_PENDING: 'verification_pending',
  PUBLISHED_VERIFIED: 'published_verified',
  PUBLISH_FAILED: 'publish_failed',
  BUFFER_QUEUED: 'buffer_queued',
  BUFFER_PARTIAL: 'buffer_partial',
  BUFFER_FAILED: 'buffer_failed',
  COMPLETE: 'complete',
};

export function articleDestPath(slug) {
  return path.join(ROOT, 'insights', slug);
}

export function isArticlePublishedOnDisk(slug) {
  return fs.existsSync(path.join(articleDestPath(slug), 'index.html'));
}

export function isProductionVerified(article) {
  return Boolean(article?.productionVerifiedAt);
}

/** @returns {boolean} Git-side published (schedule or disk) */
export function isGitPublished(article) {
  if (article?.status === EDITORIAL_STATUSES.PUBLISHED) return true;
  return isArticlePublishedOnDisk(article.slug);
}

/**
 * Derive operational state for a schedule article.
 * @param {object} article schedule.json entry
 * @param {{ now?: Date, bufferPost?: object|null }} ctx
 */
export function deriveScheduleOperationalState(article, { now = new Date(), bufferPost = null } = {}) {
  if (article.status === EDITORIAL_STATUSES.HOLD) {
    return OPERATIONAL_STATES.EDITORIAL_HOLD;
  }

  if (article.status === EDITORIAL_STATUSES.SCHEDULED && article.publishAt) {
    if (new Date(article.publishAt).getTime() <= now.getTime()) {
      return OPERATIONAL_STATES.PUBLISH_DUE;
    }
    return OPERATIONAL_STATES.SCHEDULED;
  }

  if (article.status === EDITORIAL_STATUSES.PUBLISHED || isArticlePublishedOnDisk(article.slug)) {
    if (!isProductionVerified(article)) {
      return OPERATIONAL_STATES.VERIFICATION_PENDING;
    }
    if (bufferPost) {
      return deriveBufferOperationalState(bufferPost);
    }
    return OPERATIONAL_STATES.PUBLISHED_VERIFIED;
  }

  return article.status || 'unknown';
}

export function deriveBufferOperationalState(bufferPost) {
  if (!bufferPost || bufferPost.status === EDITORIAL_STATUSES.HOLD) {
    return OPERATIONAL_STATES.EDITORIAL_HOLD;
  }

  const channels = bufferPost.channels || {};
  const queued = CHANNEL_KEYS.filter((ch) => isChannelQueued(channels[ch]));
  const eligible = CHANNEL_KEYS.filter((ch) =>
    isChannelEligible(channels[ch], { requestedChannels: CHANNEL_KEYS })
  );
  const failed = CHANNEL_KEYS.filter((ch) => channels[ch]?.status === 'failed');

  if (queued.length === CHANNEL_KEYS.length && eligible.length === 0) {
    return bufferPost.status === 'buffer_queued'
      ? OPERATIONAL_STATES.COMPLETE
      : OPERATIONAL_STATES.BUFFER_QUEUED;
  }
  if (queued.length > 0 && eligible.length > 0) {
    return OPERATIONAL_STATES.BUFFER_PARTIAL;
  }
  if (failed.length > 0 && queued.length === 0) {
    return OPERATIONAL_STATES.BUFFER_FAILED;
  }
  if (eligible.length > 0) {
    return OPERATIONAL_STATES.PUBLISHED_VERIFIED;
  }
  return bufferPost.status || OPERATIONAL_STATES.BUFFER_QUEUED;
}

export function findBufferPost(queue, slug) {
  return queue?.posts?.find((p) => p.slug === slug) || null;
}

export function getVerifiedSlugs(schedule) {
  return new Set(
    schedule.articles
      .filter((a) => isProductionVerified(a) || (a.status === EDITORIAL_STATUSES.PUBLISHED && isProductionVerified(a)))
      .map((a) => a.slug)
  );
}

export function markProductionVerified(article, verifiedAt = new Date().toISOString()) {
  article.productionVerifiedAt = verifiedAt;
  article.verificationAttemptCount = article.verificationAttemptCount || 0;
  return article;
}

export function listPublishDueArticles(articles, now = new Date()) {
  return articles.filter(
    (a) =>
      a.status === EDITORIAL_STATUSES.SCHEDULED &&
      a.publishAt &&
      new Date(a.publishAt).getTime() <= now.getTime()
  );
}

export function listVerificationPending(articles) {
  return articles.filter(
    (a) =>
      (a.status === EDITORIAL_STATUSES.PUBLISHED || isArticlePublishedOnDisk(a.slug)) &&
      !isProductionVerified(a)
  );
}
