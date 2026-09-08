#!/usr/bin/env node
/**
 * Rebuild insights/index.html cards, sitemap insight URLs, and llms insight lines
 * from schedule.json + on-disk published HTML only.
 *
 * Usage: node scripts/sync-insights-public-surfaces.mjs [--dry-run]
 */
import { syncInsightsPublicSurfaces } from './lib/insights-public-sync.mjs';

const dryRun = process.argv.includes('--dry-run');
const result = syncInsightsPublicSurfaces({ dryRun, updateFooter: false });
console.log(JSON.stringify(result, null, 2));
process.exit(0);
