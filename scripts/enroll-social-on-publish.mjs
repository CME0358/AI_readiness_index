#!/usr/bin/env node
/**
 * Enroll a published Insight in social queues (retroactive or manual).
 *
 * Usage:
 *   node scripts/enroll-social-on-publish.mjs --slug cloudflare-aeo
 *   node scripts/enroll-social-on-publish.mjs --slug cloudflare-aeo --dry-run
 */
import fs from 'node:fs';
import { PATHS } from './lib/insights-v2-paths.mjs';
import { enrollSocialOnPublish } from './lib/enroll-social-on-publish.mjs';

const dryRun = process.argv.includes('--dry-run');
const slugArg = (() => {
  const i = process.argv.indexOf('--slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();

if (!slugArg) {
  console.error('Usage: node scripts/enroll-social-on-publish.mjs --slug <slug>');
  process.exit(1);
}

const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
const article = schedule.articles.find((a) => a.slug === slugArg);
if (!article) {
  console.error('Slug not found in schedule.json:', slugArg);
  process.exit(1);
}

const result = enrollSocialOnPublish(article, { dryRun });
console.log(JSON.stringify(result, null, 2));
if (!result.enrolled && result.reason !== 'already_enrolled') {
  process.exit(1);
}
