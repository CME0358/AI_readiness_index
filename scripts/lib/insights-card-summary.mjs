/**
 * Reader-facing card summaries for Insights index / planned cards.
 * Prefer metaDescription and SEO lead over editorial brief tails in cardSummary.
 */
import { getScheduledSeoPackage } from './insights-seo-package.mjs';

const TERMINAL_PUNCT_RE = /[。！？]$/u;
const MEMO_TAIL_RE = /(?:ではなく|にとどまらず|だけではなく|論ではなく|比較ではなく)[^。！？]{0,48}$/u;
const TRUNCATED_LATIN_RE = /[A-Za-z][a-z]{0,12}$/u;

/**
 * Detect editorial-brief tails and truncated cardSummary values.
 * Does not reject legitimate comparison sentences that end with punctuation.
 */
export function looksLikeEditorialMemo(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (t.length < 16) return true;

  if (!TERMINAL_PUNCT_RE.test(t)) {
    if (TRUNCATED_LATIN_RE.test(t)) return true;
    if (MEMO_TAIL_RE.test(t)) return true;
    if (t.length <= 80 && /ではなく/.test(t)) return true;
  }
  return false;
}

export function firstSentence(text) {
  if (!text) return '';
  const trimmed = text.trim();
  const match = trimmed.match(/^[^。！？]+[。！？]/u);
  if (match) return match[0].trim();
  return trimmed;
}

export function shortenForCard(text, maxLen = 140) {
  const t = String(text || '').trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastPeriod = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'));
  if (lastPeriod >= 40) return slice.slice(0, lastPeriod + 1);
  return `${slice.replace(/[、,]\s*$/u, '')}…`;
}

/**
 * @param {object} article schedule.json entry
 * @returns {string}
 */
export function resolvePublicCardSummary(article) {
  const seo = getScheduledSeoPackage(article.slug);
  const candidates = [
    article.metaDescription,
    seo?.meta,
    seo?.lead,
    article.cardSummary,
    article.title,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!looksLikeEditorialMemo(candidate)) {
      return shortenForCard(candidate);
    }
  }

  for (const candidate of candidates) {
    const sentence = firstSentence(candidate);
    if (sentence && !looksLikeEditorialMemo(sentence)) {
      return shortenForCard(sentence);
    }
  }

  return shortenForCard(candidates[0] || article.title || '');
}
