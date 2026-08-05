#!/usr/bin/env node
/**
 * Unlock next editorial_hold article for tomorrow's publication (day-before 15:00 JST).
 *
 * Usage:
 *   node scripts/unlock-next-insight.mjs
 *   node scripts/unlock-next-insight.mjs --publish-date 2026-08-05
 *   node scripts/unlock-next-insight.mjs --now 2026-08-04T15:00:00+09:00 --dry-run
 */
import { unlockNextInsight } from './lib/unlock-next-insight.mjs';

const dryRun = process.argv.includes('--dry-run');
const publishDate = (() => {
  const i = process.argv.indexOf('--publish-date');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const nowArg = (() => {
  const i = process.argv.indexOf('--now');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('Invalid --now');
  process.exit(1);
}

const result = unlockNextInsight({ now, publishDate, dryRun });
console.log(JSON.stringify(result, null, 2));

if (result.reason === 'another_article_scheduled') {
  console.error('Cannot unlock — another article is already scheduled:', result.slug);
  process.exit(1);
}

if (result.reason?.startsWith('prepare_failed')) {
  console.error('Cannot unlock — article quality gate failed:', result.slug, result.prepare);
  process.exit(1);
}

if (result.updated) console.log('UPDATED=1');
else console.log('UPDATED=0');

process.exit(0);
