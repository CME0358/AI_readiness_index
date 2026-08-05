#!/usr/bin/env node
/**
 * Prepare a scheduled Insight HTML for publication: strip v5 batch boilerplate, validate quality.
 *
 * Usage:
 *   node scripts/prepare-scheduled-article.mjs --slug citation-vs-action
 *   node scripts/prepare-scheduled-article.mjs --scheduled   # today's scheduled v2 slug
 *   node scripts/prepare-scheduled-article.mjs --all-hold    # all editorial_hold (optional batch)
 */
import fs from 'node:fs';
import { PATHS } from './lib/insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './lib/editorial-status.mjs';
import { prepareScheduledArticle } from './lib/prepare-scheduled-article.mjs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const slugArg = arg('--slug');
const scheduledOnly = process.argv.includes('--scheduled');
const allHold = process.argv.includes('--all-hold');
const strict = !process.argv.includes('--no-strict');

function resolveSlugs() {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  if (slugArg) return [slugArg];
  if (scheduledOnly) {
    const active = schedule.articles.find(
      (a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.SCHEDULED
    );
    if (!active) {
      console.error('No scheduled v2 article in schedule.json');
      process.exit(1);
    }
    return [active.slug];
  }
  if (allHold) {
    return schedule.articles
      .filter((a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.HOLD)
      .map((a) => a.slug);
  }
  console.error('Required: --slug SLUG | --scheduled | --all-hold');
  process.exit(1);
}

function prepareSlug(slug) {
  return prepareScheduledArticle(slug, { strict });
}

const slugs = resolveSlugs();
const results = slugs.map(prepareSlug);
let anyChanged = false;
let failed = false;

for (const r of results) {
  if (r.error === 'missing_html') {
    console.error(`FAIL ${r.slug}: missing HTML`);
    failed = true;
    continue;
  }
  if (r.error === 'quality_gate') {
    console.error(`FAIL ${r.slug}: quality issues remain`, r.issues);
    failed = true;
    continue;
  }
  if (r.changed) {
    anyChanged = true;
    console.log(`FIXED ${r.slug}: ${r.removed.join(', ')}`);
  } else {
    console.log(`OK ${r.slug}: no changes`);
  }
}

if (anyChanged) console.log('UPDATED=1');
else console.log('UPDATED=0');

process.exit(failed ? 1 : 0);
