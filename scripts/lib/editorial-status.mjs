/**
 * Editorial workflow statuses for Agent Readiness Insights v2.
 *
 * draft → editorial_review → editorial_hold | ready_for_schedule → scheduled → published
 */

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
