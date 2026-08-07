#!/usr/bin/env node
/**
 * IndexNow submission CLI.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs [--dry-run] <url> [<url>...]
 */
import { submitIndexNow } from './lib/indexnow-client.mjs';

const dryRun = process.argv.includes('--dry-run');
const urls = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

if (!urls.length) {
  console.error('Usage: node scripts/submit-indexnow.mjs [--dry-run] <url> [<url>...]');
  process.exit(1);
}

const result = await submitIndexNow(urls, { dryRun });

if (result.status === 'rejected') {
  for (const item of result.rejected) {
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

if (['success', 'accepted', 'skipped', 'rate_limited', 'bad_request', 'key_verification_failed', 'validation_error', 'remote_error', 'network_error', 'error', 'unexpected'].includes(result.status)) {
  process.exit(0);
}

process.exit(0);
