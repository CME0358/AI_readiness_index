import crypto from 'node:crypto';
import { SOURCE_LEVEL } from './constants.mjs';

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length >= nb.length ? na : nb;
  if (longer.includes(shorter) && shorter.length / longer.length > 0.6) return 0.85;
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

function sameDay(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return isoA.slice(0, 10) === isoB.slice(0, 10);
}

export function buildEventId(primary) {
  const key = `${primary.company}|${primary.url}|${primary.title}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Merge raw feed items into normalized events.
 * @param {object[]} items
 * @returns {object[]}
 */
export function dedupeItemsToEvents(items) {
  const events = [];
  for (const item of items) {
    let matched = null;
    for (const ev of events) {
      const sim = titleSimilarity(ev.title, item.title);
      const companyMatch = ev.company === item.company;
      const dateMatch = sameDay(ev.published_date, item.published_date);
      const urlMatch = ev.primary_source?.url === item.url;
      if (urlMatch || (companyMatch && sim >= 0.85) || (companyMatch && dateMatch && sim >= 0.65)) {
        matched = ev;
        break;
      }
    }
    if (matched) {
      matched.secondary_sources = matched.secondary_sources || [];
      matched.secondary_sources.push({
        source_id: item.source_id,
        source_type: item.source_type,
        url: item.url,
        fetched_at: item.fetched_at,
      });
      if ((SOURCE_LEVEL[item.source_level] ?? 0) > (SOURCE_LEVEL[matched.primary_source?.source_level] ?? 0)) {
        matched.secondary_sources.push({ ...matched.primary_source, role: 'demoted' });
        matched.primary_source = item;
      }
    } else {
      events.push({
        event_id: buildEventId(item),
        company: item.company,
        title: item.title,
        url: item.url,
        published_date: item.published_date,
        excerpt: item.excerpt,
        primary_source: item,
        secondary_sources: [],
        detected_at: item.fetched_at || new Date().toISOString(),
      });
    }
  }
  for (const ev of events) {
    ev.event_id = buildEventId(ev.primary_source || ev);
  }
  return events;
}

export function countDuplicateMerges(rawCount, eventCount) {
  return Math.max(0, rawCount - eventCount);
}
