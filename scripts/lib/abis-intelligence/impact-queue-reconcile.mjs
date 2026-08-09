import { isFixtureEvent } from '../editorial-intelligence/item-origin.mjs';
import { ABIS_SEVERITY } from './constants.mjs';

const SEVERITY_ORDER = {
  [ABIS_SEVERITY.CRITICAL]: 0,
  [ABIS_SEVERITY.HIGH]: 1,
  [ABIS_SEVERITY.WATCH]: 2,
  [ABIS_SEVERITY.LOG_ONLY]: 3,
};

/**
 * Remove fixture/test entries from production impact queue.
 * Retains real historical entries not in current run.
 */
export function reconcileImpactQueue(queue, { events = [], currentImpacts = [] } = {}) {
  const eventsById = new Map(events.map((e) => [e.event_id, e]));
  const currentImpactIds = new Set(currentImpacts.map((i) => i.event_id));
  const kept = [];
  const removed = [];

  for (const entry of queue.entries || []) {
    const ev = eventsById.get(entry.event_id);
    if (ev && isFixtureEvent(ev)) {
      removed.push({ ...entry, reason: 'FIXTURE_EVENT' });
      continue;
    }
    if (entry.origin === 'fixture' || entry.origin === 'backfill') {
      removed.push({ ...entry, reason: 'FIXTURE_ORIGIN' });
      continue;
    }
    if (!currentImpactIds.has(entry.event_id) && ev && isFixtureEvent(ev)) {
      removed.push({ ...entry, reason: 'ORPHAN_FIXTURE' });
      continue;
    }
    kept.push(entry);
  }

  kept.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return (b.abis_impact_score || 0) - (a.abis_impact_score || 0);
  });

  return { queue: { ...queue, entries: kept }, removed };
}

export function filterProductionImpactEntries(entries = [], events = []) {
  const eventsById = new Map(events.map((e) => [e.event_id, e]));
  return entries.filter((e) => {
    const ev = eventsById.get(e.event_id);
    return !ev || !isFixtureEvent(ev);
  });
}
