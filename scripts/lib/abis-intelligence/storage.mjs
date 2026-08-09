import fs from 'node:fs';
import { ABIS_INTELLIGENCE_PATHS } from './paths.mjs';
import { ABIS_SEVERITY } from './constants.mjs';

const SEVERITY_ORDER = {
  [ABIS_SEVERITY.CRITICAL]: 0,
  [ABIS_SEVERITY.HIGH]: 1,
  [ABIS_SEVERITY.WATCH]: 2,
  [ABIS_SEVERITY.LOG_ONLY]: 3,
};

export function loadAbisEvents() {
  if (!fs.existsSync(ABIS_INTELLIGENCE_PATHS.events)) {
    return { version: 1, updated_at: null, impacts: [] };
  }
  return JSON.parse(fs.readFileSync(ABIS_INTELLIGENCE_PATHS.events, 'utf8'));
}

export function saveAbisEvents(store) {
  fs.mkdirSync(ABIS_INTELLIGENCE_PATHS.dir, { recursive: true });
  store.updated_at = new Date().toISOString();
  fs.writeFileSync(ABIS_INTELLIGENCE_PATHS.events, `${JSON.stringify(store, null, 2)}\n`);
}

export function loadImpactQueue() {
  if (!fs.existsSync(ABIS_INTELLIGENCE_PATHS.impactQueue)) {
    return { version: 1, updated_at: null, entries: [] };
  }
  return JSON.parse(fs.readFileSync(ABIS_INTELLIGENCE_PATHS.impactQueue, 'utf8'));
}

export function saveImpactQueue(queue) {
  fs.mkdirSync(ABIS_INTELLIGENCE_PATHS.dir, { recursive: true });
  queue.updated_at = new Date().toISOString();
  fs.writeFileSync(ABIS_INTELLIGENCE_PATHS.impactQueue, `${JSON.stringify(queue, null, 2)}\n`);
}

export function upsertImpactEntry(queue, impact, meta = {}) {
  const entries = queue.entries.filter((e) => e.event_id !== impact.event_id);
  entries.push({
    event_id: impact.event_id,
    company: impact.company,
    title: meta.title || null,
    severity: impact.severity,
    abis_impact_score: impact.abis_impact_score,
    recommended_action: impact.recommended_action,
    confidence: impact.confidence,
    ari_article_status: meta.ari_article_status || 'UNKNOWN',
    would_notify: meta.would_notify ?? false,
    notification_status: meta.notification_status || 'SKIPPED',
    review_path: meta.review_path || null,
    scored_at: impact.scored_at,
  });
  entries.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return (b.abis_impact_score || 0) - (a.abis_impact_score || 0);
  });
  return { ...queue, entries };
}

export function filterImpactsBySeverity(impacts, ...severities) {
  const set = new Set(severities);
  return impacts.filter((i) => set.has(i.severity));
}
