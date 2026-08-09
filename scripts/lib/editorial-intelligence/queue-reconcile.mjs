import {
  isFixtureEvent,
  isFixtureQueueEntry,
  isExampleUrl,
  ITEM_ORIGIN,
  productionEventIds,
} from './item-origin.mjs';

export const QUEUE_LIFECYCLE = {
  ACTIVE: 'ACTIVE',
  STALE: 'STALE',
  ARCHIVED: 'ARCHIVED',
};

/**
 * Reconcile editorial queue after a production intelligence run.
 * Removes fixture/test entries; marks orphaned real entries STALE (does not delete).
 */
export function reconcileEditorialQueue(queue, { events = [], processedEventIds = new Set() } = {}) {
  const eventsById = new Map(events.map((e) => [e.event_id, e]));
  const currentIds = productionEventIds(events);
  const kept = [];
  const removed = [];

  for (const entry of queue.entries || []) {
    if (isFixtureQueueEntry(entry, eventsById)) {
      removed.push({ ...entry, reason: 'FIXTURE' });
      continue;
    }

    const ev = eventsById.get(entry.event_id);
    if (ev && isFixtureEvent(ev)) {
      removed.push({ ...entry, reason: 'FIXTURE_EVENT' });
      continue;
    }

    if (isExampleUrl(entry.source_url || entry.url)) {
      removed.push({ ...entry, reason: 'EXAMPLE_URL' });
      continue;
    }

    if (entry.lifecycle === QUEUE_LIFECYCLE.ARCHIVED) {
      kept.push(entry);
      continue;
    }

    if (currentIds.has(entry.event_id)) {
      kept.push({
        ...entry,
        lifecycle: QUEUE_LIFECYCLE.ACTIVE,
        origin: entry.origin || ITEM_ORIGIN.LIVE,
      });
      continue;
    }

    if (processedEventIds.has(entry.event_id)) {
      kept.push({ ...entry, lifecycle: QUEUE_LIFECYCLE.ACTIVE });
      continue;
    }

    // Real historical candidate not in current fetch — retain as STALE
    kept.push({
      ...entry,
      lifecycle: QUEUE_LIFECYCLE.STALE,
      origin: entry.origin || ITEM_ORIGIN.LIVE,
    });
  }

  kept.sort((a, b) => {
    const order = { ACTIVE: 0, STALE: 1, ARCHIVED: 2 };
    const la = order[a.lifecycle] ?? 0;
    const lb = order[b.lifecycle] ?? 1;
    if (la !== lb) return la - lb;
    return (b.score || 0) - (a.score || 0);
  });

  return {
    queue: { ...queue, entries: kept },
    removed,
    activeP1: kept.filter((e) => e.priority === 'P1' && e.lifecycle === QUEUE_LIFECYCLE.ACTIVE).length,
  };
}

export function filterProductionQueueEntries(entries = []) {
  return entries.filter(
    (e) => e.lifecycle !== QUEUE_LIFECYCLE.STALE && e.lifecycle !== QUEUE_LIFECYCLE.ARCHIVED,
  );
}
