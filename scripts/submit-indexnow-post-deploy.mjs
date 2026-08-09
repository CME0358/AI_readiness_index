#!/usr/bin/env node
/**
 * Post-deploy IndexNow for freshly published Insights slugs.
 *
 * Usage:
 *   node scripts/submit-indexnow-post-deploy.mjs --slug three-pillars-ops
 *   node scripts/submit-indexnow-post-deploy.mjs --slugs three-pillars-ops,cloudflare-aeo
 *   node scripts/submit-indexnow-post-deploy.mjs --slug three-pillars-ops --dry-run
 *   node scripts/submit-indexnow-post-deploy.mjs --slug three-pillars-ops --skip-wait
 */
import { submitPostDeployIndexNow } from './lib/indexnow-post-deploy.mjs';

const dryRun = process.argv.includes('--dry-run');
const skipWait = process.argv.includes('--skip-wait');

function readArg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const slugArg = readArg('--slug');
const slugsArg = readArg('--slugs');

/** @type {string[]} */
let slugs = [];
if (slugArg) slugs.push(slugArg.trim());
if (slugsArg) {
  slugs.push(...slugsArg.split(',').map((s) => s.trim()).filter(Boolean));
}
slugs = [...new Set(slugs)];

if (!slugs.length) {
  console.error('Usage: --slug <slug> or --slugs slug1,slug2');
  process.exit(1);
}

const result = await submitPostDeployIndexNow(slugs, { dryRun, skipWait });

console.log(
  JSON.stringify({
    slugs,
    status: result.status,
    submitted: result.submitted || 0,
    httpStatus: result.httpStatus || null,
    deferred: result.deferred?.length || 0,
    blocked: result.blocked?.length || 0,
    urls: result.urls || [],
  })
);

if (result.status === 'blocked') process.exit(1);
process.exit(0);
