import fs from 'node:fs';
import { INTELLIGENCE_PATHS } from './paths.mjs';
import { SOURCE_HEALTH, DEFAULT_POLLING_HOURS } from './constants.mjs';

export function loadSourcesRegistry() {
  if (!fs.existsSync(INTELLIGENCE_PATHS.sources)) {
    return { version: 1, polling_default_hours: DEFAULT_POLLING_HOURS, sources: [] };
  }
  return JSON.parse(fs.readFileSync(INTELLIGENCE_PATHS.sources, 'utf8'));
}

export function saveSourcesRegistry(registry) {
  fs.mkdirSync(INTELLIGENCE_PATHS.dir, { recursive: true });
  fs.writeFileSync(INTELLIGENCE_PATHS.sources, `${JSON.stringify(registry, null, 2)}\n`);
}

export function getSourceById(registry, sourceId) {
  return registry.sources.find((s) => s.source_id === sourceId) || null;
}

export function updateSourceHealth(source, { success, error = null, latestItemDate = null } = {}) {
  const next = { ...source };
  if (success) {
    next.last_checked_at = new Date().toISOString();
    next.consecutive_failures = 0;
    next.last_failure_at = null;
    next.last_error = null;
    if (latestItemDate) next.latest_item_date = latestItemDate;
    next.health_status =
      next.consecutive_failures >= 3
        ? SOURCE_HEALTH.FAILED
        : next.consecutive_failures >= 1
          ? SOURCE_HEALTH.DEGRADED
          : SOURCE_HEALTH.HEALTHY;
  } else {
    next.last_checked_at = new Date().toISOString();
    next.consecutive_failures = (next.consecutive_failures || 0) + 1;
    next.last_failure_at = new Date().toISOString();
    next.last_error = error || 'FETCH_FAILED';
    next.health_status =
      next.consecutive_failures >= 3
        ? SOURCE_HEALTH.FAILED
        : SOURCE_HEALTH.DEGRADED;
  }
  return next;
}

export function listEnabledSources(registry) {
  return registry.sources.filter((s) => s.polling_enabled !== false);
}
