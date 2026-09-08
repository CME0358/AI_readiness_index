/**
 * Backfill packageReadiness for scheduled articles missing hero state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT } from './insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import {
  markHeroPending,
  markHeroReady,
  PACKAGE_STATES,
} from './insights-package-readiness.mjs';
import { canonicalHeroPath } from './local-visual-worker.mjs';

export function ensureScheduledPackageReadiness(schedule, { root, now = new Date() } = {}) {
  let updated = 0;
  for (const article of schedule.articles || []) {
    if (article.status !== EDITORIAL_STATUSES.SCHEDULED || !article.publishAt) continue;
    const heroExists = fs.existsSync(canonicalHeroPath({ root, assetsPath: path.join(root, 'assets/insights') }, article.slug));
    if (heroExists) {
      if (article.packageReadiness !== PACKAGE_STATES.PACKAGE_READY) {
        markHeroReady(article, { now });
        updated += 1;
      }
      continue;
    }
    if (!article.packageReadiness || article.packageReadiness === PACKAGE_STATES.PACKAGE_READY) {
      markHeroPending(article, { now });
      updated += 1;
    }
  }
  return { updated };
}

export function ensureScheduledPackageReadinessOnDisk({ root = ROOT, dryRun = false, now = new Date() } = {}) {
  const schedulePath = path.join(root, 'insights/_scheduled/schedule.json');
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  const result = ensureScheduledPackageReadiness(schedule, { root, now });
  if (result.updated && !dryRun) {
    fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
  }
  return result;
}
