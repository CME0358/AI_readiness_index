import fs from 'node:fs';
import crypto from 'node:crypto';
import { ABIS_INTELLIGENCE_PATHS } from './paths.mjs';
import { ABIS_SEVERITY } from './constants.mjs';
import { isFixtureEvent } from '../editorial-intelligence/item-origin.mjs';

const SEVERITY_RANK = {
  [ABIS_SEVERITY.LOG_ONLY]: 0,
  [ABIS_SEVERITY.WATCH]: 1,
  [ABIS_SEVERITY.HIGH]: 2,
  [ABIS_SEVERITY.CRITICAL]: 3,
};

export function loadNotificationState() {
  const path = ABIS_INTELLIGENCE_PATHS.notificationState;
  if (!fs.existsSync(path)) {
    return { version: 1, updated_at: null, notifications: {} };
  }
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export function saveNotificationState(state) {
  fs.mkdirSync(ABIS_INTELLIGENCE_PATHS.dir, { recursive: true });
  state.updated_at = new Date().toISOString();
  fs.writeFileSync(ABIS_INTELLIGENCE_PATHS.notificationState, `${JSON.stringify(state, null, 2)}\n`);
}

export function buildImpactSignature(impact = {}) {
  const parts = [
    impact.event_id || '',
    impact.severity || '',
    String(impact.abis_impact_score ?? ''),
    (impact.affected_areas || []).slice().sort().join(','),
    JSON.stringify(impact.dimension_scores || {}),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

export function buildNotificationFingerprint(impact = {}) {
  return `${impact.event_id}|${impact.severity}|${buildImpactSignature(impact)}`;
}

/**
 * Decide whether to send Slack for this impact (Cases A–E).
 * @returns {{ send: boolean, reason: string, fingerprint: string }}
 */
export function evaluateNotificationDedup(impact, state, { event = null, previousStatus = null } = {}) {
  const fingerprint = buildNotificationFingerprint(impact);

  if (event && isFixtureEvent(event)) {
    return { send: false, reason: 'FIXTURE_NEVER_SEND', fingerprint };
  }

  const notifySeverities = new Set([ABIS_SEVERITY.HIGH, ABIS_SEVERITY.CRITICAL]);
  if (!notifySeverities.has(impact.severity)) {
    return { send: false, reason: 'SEVERITY_BELOW_THRESHOLD', fingerprint };
  }

  const record = state.notifications?.[impact.event_id];
  if (!record) {
    return { send: true, reason: 'FIRST_NOTIFICATION', fingerprint };
  }

  if (record.notification_status === 'FAILED' || previousStatus === 'FAILED') {
    return { send: true, reason: 'RETRY_AFTER_FAILURE', fingerprint };
  }

  const prevRank = SEVERITY_RANK[record.notification_severity] ?? 0;
  const nextRank = SEVERITY_RANK[impact.severity] ?? 0;
  if (nextRank > prevRank) {
    return { send: true, reason: 'SEVERITY_ESCALATION', fingerprint };
  }

  if (record.notification_fingerprint !== fingerprint) {
    return { send: true, reason: 'IMPACT_MATERIAL_CHANGE', fingerprint };
  }

  if (record.notification_status === 'SENT' && record.notification_fingerprint === fingerprint) {
    return { send: false, reason: 'DUPLICATE_BLOCKED', fingerprint };
  }

  return { send: true, reason: 'ALLOW', fingerprint };
}

export function recordNotificationState(state, impact, result, { fingerprint } = {}) {
  const fp = fingerprint || buildNotificationFingerprint(impact);
  const next = { ...state, notifications: { ...(state.notifications || {}) } };
  const prev = next.notifications[impact.event_id] || {};

  next.notifications[impact.event_id] = {
    event_id: impact.event_id,
    notification_status: result.notification_status || (result.sent ? 'SENT' : prev.notification_status || 'SKIPPED'),
    notification_sent_at: result.sent ? new Date().toISOString() : prev.notification_sent_at || null,
    notification_severity: impact.severity,
    notification_fingerprint: fp,
    last_attempt_at: new Date().toISOString(),
  };

  return next;
}
