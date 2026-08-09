/**
 * RMVU-05F — GitHub Actions / local persistence behavior audit helpers.
 * Documents what survives across ephemeral runner restarts.
 */

export const PERSISTENCE_CLASS = {
  PERSISTENT: 'PERSISTENT',
  EPHEMERAL: 'EPHEMERAL',
  PARTIAL: 'PARTIAL',
};

/** Paths written during intelligence runs (under crucial_data/). */
export const RUNTIME_STATE_PATHS = [
  'crucial_data/editorial/intelligence/events.json',
  'crucial_data/editorial/intelligence/queue.json',
  'crucial_data/editorial/intelligence/sources.json',
  'crucial_data/abis-intelligence/events.json',
  'crucial_data/abis-intelligence/impact-queue.json',
  'crucial_data/abis-intelligence/notification-state.json',
];

/**
 * Without GHA cache or external store, runner filesystem is EPHEMERAL.
 * With actions/cache restore/save of crucial_data/, state is PARTIAL (best-effort).
 */
export function classifyRunnerPersistence({ ghaCacheEnabled = false } = {}) {
  if (ghaCacheEnabled) {
    return {
      class: PERSISTENCE_CLASS.PARTIAL,
      last_seen: 'PARTIAL via actions/cache (best-effort)',
      queue: 'PARTIAL via actions/cache',
      notification_state: 'PARTIAL via actions/cache',
      durable_cross_run_dedup: false,
      note: 'Cache is not a durable database; treat as best-effort until external store exists.',
    };
  }
  return {
    class: PERSISTENCE_CLASS.EPHEMERAL,
    last_seen: 'EPHEMERAL — lost each GHA run',
    queue: 'EPHEMERAL — lost each GHA run',
    notification_state: 'EPHEMERAL — lost each GHA run',
    durable_cross_run_dedup: false,
    note: 'Local dev persists; GitHub Actions runner resets unless cache configured.',
  };
}

export function workflowUsesStateCache(workflowYaml = '') {
  return /actions\/cache\/(restore|save)@v[34]/.test(workflowYaml) && /crucial_data/.test(workflowYaml);
}
