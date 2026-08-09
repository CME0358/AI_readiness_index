#!/usr/bin/env node
/**
 * IndexNow submission CLI.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs [--dry-run] <url> [<url>...]
 *   node scripts/submit-indexnow.mjs --full-site [--dry-run]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitIndexNow } from './lib/indexnow-client.mjs';
import { collectIndexNowEligibleUrls } from './lib/indexnow-eligibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const fullSite = process.argv.includes('--full-site');
const urls = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

if (fullSite) {
  const inventory = collectIndexNowEligibleUrls({ root: ROOT, now: new Date() });
  console.log(`IndexNow full-site: ${inventory.eligible.length} eligible of ${inventory.discovered} discovered`);
  if (inventory.excluded.length) {
    console.log(`Excluded: ${inventory.excluded.length} (duplicates removed: ${inventory.duplicates})`);
  }
  const result = await submitIndexNow(inventory.eligible, {
    dryRun,
    enforceEligibility: true,
    root: ROOT,
  });
  if (result.status === 'blocked') process.exit(2);
  process.exit(0);
}

if (!urls.length) {
  console.error('Usage: node scripts/submit-indexnow.mjs [--dry-run] <url> [<url>...]');
  console.error('       node scripts/submit-indexnow.mjs --full-site [--dry-run]');
  process.exit(1);
}

const result = await submitIndexNow(urls, { dryRun, enforceEligibility: true, root: ROOT });

if (result.status === 'rejected' || result.status === 'blocked') {
  for (const item of result.rejected || []) {
    console.error(`REJECTED: ${item.url} — ${item.reason}`);
  }
  process.exit(1);
}

if (result.status === 'skipped' && result.reason?.includes('INDEXNOW_KEY')) {
  console.warn('IndexNow: SKIPPED — INDEXNOW_KEY not configured');
  process.exit(0);
}

if (result.status === 'dry_run') {
  process.exit(0);
}

process.exit(0);
