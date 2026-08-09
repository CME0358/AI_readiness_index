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
 * Evaluate ABIS impact for all normalized events (private path).
 * Does not mutate repository assets. Slack failures are non-fatal.
 */
export async function processAbisImpactWatch(events, options = {}) {
  const {
    dryRun = true,
    notify = false,
    ariStatusByEventId = new Map(),
  } = options;

  const impacts = [];
  const notifications = [];
  let queue = loadImpactQueue();

  for (const event of events) {
    const impact = scoreAbisImpact(event);
    const ariStatus = ariStatusByEventId.get(event.event_id) || event.status || 'DETECTED';

    const reviewPath = writeAbisReview(event, impact, { ari_article_status: ariStatus });

    let notificationResult = { would_notify: false, notification_status: 'SKIPPED' };
    try {
      notificationResult = await notifyAbisImpact(impact, {
        dryRun,
        notify,
        title: event.title,
        ari_article_status: ariStatus,
      });
    } catch (err) {
      notificationResult = {
        would_notify: impact.severity === ABIS_SEVERITY.CRITICAL || impact.severity === ABIS_SEVERITY.HIGH,
        notification_status: 'FAILED',
        error: sanitizeLogMessage(err?.message || String(err)),
      };
    }

    impacts.push({
      ...impact,
      title: event.title,
      ari_article_status: ariStatus,
      review_path: reviewPath,
      would_notify: notificationResult.would_notify,
      notification_status: notificationResult.notification_status,
    });

    notifications.push({ event_id: event.event_id, ...notificationResult });

    queue = upsertImpactEntry(queue, impact, {
      title: event.title,
      ari_article_status: ariStatus,
      would_notify: notificationResult.would_notify,
      notification_status: notificationResult.notification_status,
      review_path: reviewPath,
    });
  }

  const store = loadAbisEvents();
  store.impacts = impacts;
  saveAbisEvents(store);
  saveImpactQueue(queue);

  const abisBriefSection = generateAbisDailyBriefSection(impacts);

  return {
    impacts,
    notifications,
    queue,
    abisBriefSection,
    critical: filterImpactsBySeverity(impacts, ABIS_SEVERITY.CRITICAL),
    high: filterImpactsBySeverity(impacts, ABIS_SEVERITY.HIGH),
    watch: filterImpactsBySeverity(impacts, ABIS_SEVERITY.WATCH),
    logOnly: filterImpactsBySeverity(impacts, ABIS_SEVERITY.LOG_ONLY),
  };
}
