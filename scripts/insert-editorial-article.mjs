#!/usr/bin/env node
import { PATHS } from './lib/insights-v2-paths.mjs';
import { applyEmergencyInsertion, SLOT_TYPES } from './lib/editorial-schedule-buffer.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const slug = value('--slug');
const targetDate = value('--date');
const dryRun = args.includes('--dry-run');
if (!slug || !targetDate) {
  console.error('Usage: node scripts/insert-editorial-article.mjs --slug SLUG --date YYYY-MM-DD [--dry-run] [--apply]');
  process.exit(1);
}
const queue = fs.existsSync(PATHS.bufferQueue) ? JSON.parse(fs.readFileSync(PATHS.bufferQueue, 'utf8')) : { posts: [] };
const plan = applyEmergencyInsertion({
  schedulePath: PATHS.schedule,
  slug,
  targetDate,
  slotType: SLOT_TYPES.DAILY_PRIMARY,
  bufferQueue: queue.posts,
  dryRun: dryRun || !args.includes('--apply'),
});
console.log(JSON.stringify({
  safe: plan.safe,
  reason: plan.reason,
  before: plan.before.articles.filter((entry) => entry.publishAt).map(({ slug: itemSlug, publishAt, publicationId }) => ({ slug: itemSlug, publishAt, publicationId })),
  after: plan.after.articles.filter((entry) => entry.publishAt).map(({ slug: itemSlug, publishAt, publicationId }) => ({ slug: itemSlug, publishAt, publicationId })),
  displaced: plan.displaced,
  bufferImpact: plan.bufferImpact,
  heroImpact: plan.heroImpact,
  applied: Boolean(plan.applied),
}, null, 2));
process.exit(plan.safe ? 0 : 2);
