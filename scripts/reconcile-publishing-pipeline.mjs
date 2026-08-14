#!/usr/bin/env node
/**
 * Operational reconciliation worker: publish → verify → buffer.
 *
 * Usage:
 *   node scripts/reconcile-publishing-pipeline.mjs
 *   node scripts/reconcile-publishing-pipeline.mjs --dry-run
 *   node scripts/reconcile-publishing-pipeline.mjs --force-slug readiness-baseline
 *   node scripts/reconcile-publishing-pipeline.mjs --now 2026-08-13T10:30:00+09:00
 *   node scripts/reconcile-publishing-pipeline.mjs --skip-publish --skip-verify
 */
import { isWeekday } from './lib/business-days.mjs';
import { reconcilePublishingPipeline } from './lib/publishing-reconcile.mjs';

const dryRun = process.argv.includes('--dry-run');
const forceSlug = (() => {
  const i = process.argv.indexOf('--force-slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const nowArg = (() => {
  const i = process.argv.indexOf('--now');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const skipPublish = process.argv.includes('--skip-publish');
const skipVerify = process.argv.includes('--skip-verify');
const skipBuffer = process.argv.includes('--skip-buffer');
const fastVerify = process.argv.includes('--fast-verify');

const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('Invalid --now');
  process.exit(1);
}

async function main() {
  if (!isWeekday(now) && !forceSlug) {
    console.log('Weekend — no reconciliation.', { now: now.toISOString() });
    process.exit(0);
  }

  const summary = await reconcilePublishingPipeline({
    now,
    dryRun,
    forceSlug,
    skipPublish,
    skipVerify,
    skipBuffer,
    fastVerify,
  });

  console.log(JSON.stringify(summary, null, 2));

  if (summary.activeSlug) console.log(`ACTIVE_SLUG=${summary.activeSlug}`);

  if (summary.publish?.published?.length) {
    console.log('Published:', summary.publish.published.join(', '));
  }
  if (summary.updated) console.log('UPDATED=1');
  else console.log('UPDATED=0');

  // Publish errors are fatal; verify failures are retryable on the next cron after git push + deploy.
  const publishFailed = summary.publish?.errors?.length;
  process.exit(publishFailed && !dryRun ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
