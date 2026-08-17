/**
 * Editorial workflow statuses for Agent Readiness Insights v2.
 *
 * draft → editorial_review → editorial_hold | ready_for_schedule → scheduled → published
 */
import { isProtectedInternalLinkSlug } from './insights-related-links.mjs';

export const EDITORIAL_STATUSES = {
  HOLD: 'editorial_hold',
  REVIEW: 'editorial_review',
  READY: 'ready_for_schedule',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
};

export const INITIAL_SLUG = 'ai-search-shift';

/** @returns {boolean} Web publish eligible */
export function isPublishEligible(article, { forceSlug = null } = {}) {
  if (isProtectedInternalLinkSlug(article.slug)) return false;
  if (article.status === EDITORIAL_STATUSES.HOLD) return false;
  if (forceSlug) {
    return article.slug === forceSlug && article.status === EDITORIAL_STATUSES.SCHEDULED && !!article.publishAt;
  }
  return article.status === EDITORIAL_STATUSES.SCHEDULED && !!article.publishAt;
}

/** @returns {boolean} Buffer transfer eligible (excludes editorial_hold always) */
export function isBufferEligible(post, { forceSlug = null } = {}) {
  if (post.status === EDITORIAL_STATUSES.HOLD) return false;
  const transferable = new Set([
    EDITORIAL_STATUSES.SCHEDULED,
    'article_published',
    'ready_for_buffer',
    'article_url_unavailable',
    'buffer_transfer_failed',
  ]);
  if (forceSlug) {
    return post.slug === forceSlug && transferable.has(post.status);
  }
  return transferable.has(post.status);
}

export function extractDueArticles(articles, now, forceSlug = null) {
  return articles.filter((a) => {
    if (!isPublishEligible(a, { forceSlug })) return false;
    if (forceSlug) return a.slug === forceSlug;
    return new Date(a.publishAt).getTime() <= now.getTime();
  });
}

/**
 * Select exactly one article. Prefer the article assigned to the current JST
 * date, then recover the oldest overdue article. Input order is irrelevant.
 */
export function selectNextDueArticle(articles, now, forceSlug = null) {
  const due = extractDueArticles(articles, now, forceSlug);
  if (forceSlug) return due[0] || null;

  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  return [...due].sort((a, b) => {
    const aToday = a.publishAt?.slice(0, 10) === today ? 0 : 1;
    const bToday = b.publishAt?.slice(0, 10) === today ? 0 : 1;
    if (aToday !== bToday) return aToday - bToday;
    const byTime = new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime();
    return byTime || String(a.slug).localeCompare(String(b.slug));
  })[0] || null;
}
