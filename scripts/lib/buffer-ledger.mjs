import { toJstDateString } from './business-days.mjs';

/** Normalize legacy Buffer entries without rewriting historical files. */
export function normalizePublicationDate(post) {
  if (post?.publicationDate) return post.publicationDate;
  const source = post?.articlePublishAt || post?.bufferTransferAt || post?.channels?.linkedin?.publishAt;
  return source ? toJstDateString(new Date(source)) : null;
}

export function bufferLedgerKey(postOrSlug, publicationDate = null) {
  const slug = typeof postOrSlug === 'string' ? postOrSlug : postOrSlug?.slug;
  const date = typeof postOrSlug === 'string'
    ? publicationDate
    : normalizePublicationDate(postOrSlug);
  return slug && date ? `${slug}::${date}` : slug || null;
}

export function isSameBufferLedgerEntry(post, slug, publicationDate = null) {
  if (!post || post.slug !== slug) return false;
  return publicationDate == null || normalizePublicationDate(post) === publicationDate;
}

/** Return canonical ledger identities that occur more than once. */
export function duplicateBufferLedgerKeys(posts = []) {
  const counts = new Map();
  for (const post of posts) {
    if (!post?.slug) continue;
    const key = `${post.slug}::${normalizePublicationDate(post) || 'MISSING_DATE'}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}
