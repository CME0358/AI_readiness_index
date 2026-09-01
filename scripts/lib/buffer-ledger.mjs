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
