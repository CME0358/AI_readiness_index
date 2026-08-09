import fs from 'node:fs';
import { ABIS_SEVERITY } from './constants.mjs';
import { ABIS_INTELLIGENCE_PATHS } from './paths.mjs';
import { scoreAbisImpact } from './scoring.mjs';
import {
  loadAbisEvents,
  saveAbisEvents,
  loadImpactQueue,
  saveImpactQueue,
  upsertImpactEntry,
  filterImpactsBySeverity,
} from './storage.mjs';
import { writeAbisReview } from './review-generator.mjs';
import { notifyAbisImpact, sanitizeLogMessage } from './slack-notifier.mjs';
import {
  loadNotificationState,
  saveNotificationState,
  evaluateNotificationDedup,
  recordNotificationState,
} from './notification-state.mjs';
import { reconcileImpactQueue } from './impact-queue-reconcile.mjs';
import { isFixtureEvent, ITEM_ORIGIN } from '../editorial-intelligence/item-origin.mjs';

export function generateAbisDailyBriefSection(impacts = []) {
  const critical = filterImpactsBySeverity(impacts, ABIS_SEVERITY.CRITICAL);
  const high = filterImpactsBySeverity(impacts, ABIS_SEVERITY.HIGH);
  const watch = filterImpactsBySeverity(impacts, ABIS_SEVERITY.WATCH);

  const lines = [
    '## ABIS Impact Watch (PRIVATE — NOT FOR PUBLIC)',
    '',
    '> Internal only. Do not copy to reports/, public_build, sitemap, or llms.txt.',
    '',
    '### Critical',
    '',
  ];

  if (!critical.length) lines.push('- (none)');
  else {
    for (const i of critical) {
      lines.push(`- **${i.company}** — score ${i.abis_impact_score} · ${i.recommended_action}`);
    }
  }

  lines.push('', '### High', '');
  if (!high.length) lines.push('- (none)');
  else {
    for (const i of high) {
      lines.push(`- **${i.company}** — score ${i.abis_impact_score} · ${i.recommended_action}`);
    }
  }

  lines.push('', '### Watch', '');
  if (!watch.length) lines.push('- (none)');
  else {
    for (const i of watch) {
      lines.push(`- ${i.company} — score ${i.abis_impact_score}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function writePrivateDailyBrief(abisSection, { editorialBriefPath = null } = {}) {
  const parts = [
    '# Internal Daily Brief — Editorial + ABIS Impact Watch',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '---',
    '',
    abisSection,
    '',
    '---',
    '',
    '## Editorial Intelligence (reference)',
    '',
    editorialBriefPath && fs.existsSync(editorialBriefPath)
      ? fs.readFileSync(editorialBriefPath, 'utf8')
      : '- See reports/Editorial Intelligence Latest.md (ARI-only, public-safe copy)',
    '',
  ];
  fs.mkdirSync(ABIS_INTELLIGENCE_PATHS.dir, { recursive: true });
  fs.writeFileSync(ABIS_INTELLIGENCE_PATHS.internalDailyBrief, parts.join('\n'));
}

/**
 * Evaluate ABIS impact for normalized production events (private path).
 * Slack dedup via notification-state.json; fixture events never notify.
 */
export async function processAbisImpactWatch(events, options = {}) {
  const {
    dryRun = true,
    notify = false,
    allowFixtures = false,
    ariStatusByEventId = new Map(),
  } = options;

  const impacts = [];
  const notifications = [];
  let queue = loadImpactQueue();
  let notificationState = loadNotificationState();

  for (const event of events) {
    if (isFixtureEvent(event) && !allowFixtures) continue;

    const impact = scoreAbisImpact(event);
    const ariStatus = ariStatusByEventId.get(event.event_id) || event.status || 'DETECTED';

    const reviewPath = writeAbisReview(event, impact, { ari_article_status: ariStatus });

    const dedup = evaluateNotificationDedup(impact, notificationState, { event });
    let notificationResult = {
      would_notify: dedup.send,
      notification_status: dedup.send ? 'PENDING' : 'SKIPPED',
      dedup_reason: dedup.reason,
    };

    if (dedup.send) {
      try {
        notificationResult = {
          ...notificationResult,
          ...(await notifyAbisImpact(impact, {
            dryRun,
            notify,
            title: event.title,
            ari_article_status: ariStatus,
            announcement_excerpt: event.excerpt,
          })),
          dedup_reason: dedup.reason,
        };
      } catch (err) {
        notificationResult = {
          would_notify: true,
          notification_status: 'FAILED',
          error: sanitizeLogMessage(err?.message || String(err)),
          dedup_reason: dedup.reason,
        };
      }
    } else {
      notificationResult = {
        would_notify: false,
        notification_status: 'SKIPPED',
        dedup_reason: dedup.reason,
      };
    }

    if (notificationResult.notification_status === 'SENT' || notificationResult.sent) {
      notificationState = recordNotificationState(notificationState, impact, notificationResult, {
        fingerprint: dedup.fingerprint,
      });
    } else if (notificationResult.notification_status === 'FAILED') {
      notificationState = recordNotificationState(notificationState, impact, {
        ...notificationResult,
        sent: false,
      }, { fingerprint: dedup.fingerprint });
    }

    impacts.push({
      ...impact,
      title: event.title,
      ari_article_status: ariStatus,
      review_path: reviewPath,
      would_notify: notificationResult.would_notify,
      notification_status: notificationResult.notification_status,
      dedup_reason: notificationResult.dedup_reason,
    });

    notifications.push({ event_id: event.event_id, ...notificationResult });

    queue = upsertImpactEntry(queue, impact, {
      title: event.title,
      ari_article_status: ariStatus,
      would_notify: notificationResult.would_notify,
      notification_status: notificationResult.notification_status,
      review_path: reviewPath,
      origin: event.origin || ITEM_ORIGIN.LIVE,
    });
  }

  const reconciled = reconcileImpactQueue(queue, { events, currentImpacts: impacts });
  queue = reconciled.queue;

  const store = loadAbisEvents();
  store.impacts = impacts;
  saveAbisEvents(store);
  saveImpactQueue(queue);
  saveNotificationState(notificationState);

  const abisBriefSection = generateAbisDailyBriefSection(impacts);

  return {
    impacts,
    notifications,
    queue,
    abisBriefSection,
    impactQueueReconciled: reconciled.removed.length,
    critical: filterImpactsBySeverity(impacts, ABIS_SEVERITY.CRITICAL),
    high: filterImpactsBySeverity(impacts, ABIS_SEVERITY.HIGH),
    watch: filterImpactsBySeverity(impacts, ABIS_SEVERITY.WATCH),
    logOnly: filterImpactsBySeverity(impacts, ABIS_SEVERITY.LOG_ONLY),
  };
}
