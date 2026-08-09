import fs from 'node:fs';
import { INTELLIGENCE_PATHS } from './paths.mjs';
import { PRIORITY_BANDS, EVENT_STATUSES } from './constants.mjs';
import { isProtectedInternalLinkSlug } from '../insights-related-links.mjs';
import { ITEM_ORIGIN } from './item-origin.mjs';
import { QUEUE_LIFECYCLE } from './queue-reconcile.mjs';

const PRIORITY_ORDER = {
  [PRIORITY_BANDS.P0]: 0,
  [PRIORITY_BANDS.P1]: 1,
  [PRIORITY_BANDS.P2]: 2,
  [PRIORITY_BANDS.P3]: 3,
  [PRIORITY_BANDS.P4]: 4,
  [PRIORITY_BANDS.MONITOR]: 5,
  [PRIORITY_BANDS.IGNORE]: 9,
};

export function loadQueue() {
  if (!fs.existsSync(INTELLIGENCE_PATHS.queue)) {
    return { version: 1, updated_at: null, entries: [] };
  }
  return JSON.parse(fs.readFileSync(INTELLIGENCE_PATHS.queue, 'utf8'));
}

export function saveQueue(queue) {
  fs.mkdirSync(INTELLIGENCE_PATHS.dir, { recursive: true });
  queue.updated_at = new Date().toISOString();
  fs.writeFileSync(INTELLIGENCE_PATHS.queue, `${JSON.stringify(queue, null, 2)}\n`);
}

export function loadEvents() {
  if (!fs.existsSync(INTELLIGENCE_PATHS.events)) {
    return { version: 1, updated_at: null, events: [] };
  }
  return JSON.parse(fs.readFileSync(INTELLIGENCE_PATHS.events, 'utf8'));
}

export function saveEvents(store) {
  fs.mkdirSync(INTELLIGENCE_PATHS.dir, { recursive: true });
  store.updated_at = new Date().toISOString();
  fs.writeFileSync(INTELLIGENCE_PATHS.events, `${JSON.stringify(store, null, 2)}\n`);
}

export function upsertQueueEntry(queue, candidate) {
  if (isProtectedInternalLinkSlug(candidate.slug_proposal)) return queue;
  const entries = queue.entries.filter((e) => e.event_id !== candidate.event_id);
  entries.push({
    event_id: candidate.event_id,
    company: candidate.company,
    title: candidate.title,
    priority: candidate.priority,
    score: candidate.score,
    freshness: candidate.freshness,
    status: candidate.status || EVENT_STATUSES.READY_FOR_EDITORIAL_REVIEW,
    article_type: candidate.article_type,
    slug_proposal: candidate.slug_proposal,
    draft_path: candidate.draft_path,
    detected_at: candidate.detected_at,
    origin: candidate.primary_source?.origin || candidate.origin || ITEM_ORIGIN.LIVE,
    lifecycle: QUEUE_LIFECYCLE.ACTIVE,
    source_url: candidate.url || candidate.primary_source?.url || null,
  });
  entries.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.score || 0) - (a.score || 0);
  });
  return { ...queue, entries };
}

export function buildBreakingAlert(candidate) {
  return {
    company: candidate.company,
    source: candidate.url,
    title: candidate.title,
    published: candidate.published_date,
    score: candidate.score,
    priority: candidate.priority,
    ari_impact: candidate.ari_layers,
    recommended_action: candidate.article_type,
    article_candidate: candidate.slug_proposal,
    existing_page_conflict: candidate.canonical_conflict || 'none',
    freshness_deadline: '72h for P0/P1 preemption window',
  };
}

export function filterQueueByPriority(queue, ...priorities) {
  const set = new Set(priorities);
  return queue.entries.filter((e) => set.has(e.priority));
}
