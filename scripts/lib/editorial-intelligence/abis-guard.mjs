import { ABIS_BLOCK_TERMS } from './constants.mjs';
import { PROTECTED_ABIS_SLUGS } from '../product-integrity.mjs';
import { isProtectedInternalLinkSlug } from '../insights-related-links.mjs';

export function containsAbisContent(text) {
  if (!text) return false;
  for (const term of ABIS_BLOCK_TERMS) {
    if (new RegExp(term, 'i').test(text)) return true;
  }
  for (const slug of PROTECTED_ABIS_SLUGS) {
    if (text.includes(slug)) return true;
  }
  return false;
}

export function blockIfAbis(eventOrDraft) {
  const blob = JSON.stringify(eventOrDraft);
  if (containsAbisContent(blob)) {
    return { blocked: true, reason: 'PROTECTED_ABIS' };
  }
  if (eventOrDraft.slug && isProtectedInternalLinkSlug(eventOrDraft.slug)) {
    return { blocked: true, reason: 'PROTECTED_SLUG' };
  }
  return { blocked: false };
}
