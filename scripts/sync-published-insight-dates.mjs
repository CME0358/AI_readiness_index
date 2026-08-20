#!/usr/bin/env node
/**
 * Align published Insight article dates with insights/index.html listing cards.
 *
 * Usage:
 *   node scripts/sync-published-insight-dates.mjs
 *   node scripts/sync-published-insight-dates.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/insights-v2-paths.mjs';
import {
  extractInsightPublicationDate,
  parseListingInsightDates,
  syncPublishedInsightDatesFromListing,
} from './lib/insights-publication-date.mjs';

const dryRun = process.argv.includes('--dry-run');

function countRemainingMismatches(root) {
  const indexHtml = fs.readFileSync(path.join(root, 'insights/index.html'), 'utf8');
  const listingDates = parseListingInsightDates(indexHtml);
  const mismatches = [];

  for (const [slug, listingYmd] of listingDates.entries()) {
    const articlePath = path.join(root, 'insights', slug, 'index.html');
    if (!fs.existsSync(articlePath)) continue;
    const html = fs.readFileSync(articlePath, 'utf8');
    const articleYmd = extractInsightPublicationDate(html);
    if (articleYmd !== listingYmd) {
      mismatches.push({ slug, listingYmd, articleYmd });
    }
  }

  return mismatches;
}

const before = countRemainingMismatches(ROOT);
const result = syncPublishedInsightDatesFromListing(ROOT, { dryRun });
const after = dryRun ? before : countRemainingMismatches(ROOT);

console.log(JSON.stringify({ dryRun, before: before.length, synced: result.synced, after: after.length }, null, 2));

if (after.length) {
  process.exit(1);
}
