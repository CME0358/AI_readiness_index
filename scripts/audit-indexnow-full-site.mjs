#!/usr/bin/env node
/**
 * IndexNow full-site safety audit (dry-run inventory).
 *
 * Usage:
 *   node scripts/audit-indexnow-full-site.mjs [--json] [--verify-http]
 */
import {
  collectIndexNowEligibleUrls,
  classifyIndexNowCandidate,
  insightSlugFromIndexNowUrl,
  summarizeIndexNowExclusions,
} from './lib/indexnow-eligibility.mjs';
import { insightPublishUrl } from './lib/indexnow-client.mjs';
import { PROTECTED_INTERNAL_LINK_SLUGS } from './lib/insights-related-links.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonOut = process.argv.includes('--json');
const verifyHttp = process.argv.includes('--verify-http');

const inventory = collectIndexNowEligibleUrls({ root: ROOT, now: new Date() });
const summary = summarizeIndexNowExclusions(inventory.excluded);

const cloudflareVerdict = classifyIndexNowCandidate(insightPublishUrl('cloudflare-aeo'), { root: ROOT });
const protectedChecks = [...PROTECTED_INTERNAL_LINK_SLUGS].map((slug) => ({
  slug,
  verdict: classifyIndexNowCandidate(insightPublishUrl(slug), { root: ROOT }),
}));

let http404 = [];
if (verifyHttp) {
  const checks = [insightPublishUrl('cloudflare-aeo'), ...inventory.eligible.slice(0, 3)];
  for (const url of checks) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.status === 404) http404.push(url);
    } catch (err) {
      http404.push(`${url} (${err.message})`);
    }
  }
}

const futureInEligible = inventory.eligible.filter((u) => {
  const slug = insightSlugFromIndexNowUrl(u);
  return slug === 'cloudflare-aeo' || slug === 'three-pillars-ops';
}).length;

const report = {
  totalDiscovered: inventory.discovered,
  eligible: inventory.eligible.length,
  eligibleUrls: inventory.eligible,
  excludedFuturePublishAt: summary.future_publishAt,
  excludedScheduled: summary.scheduled,
  excludedEditorialHold: summary.editorial_hold,
  excluded404: summary['404'],
  excludedNoindex: summary.noindex,
  excludedProtected: summary.protected,
  excludedPrivate: summary.private,
  excludedFixture: summary.fixture,
  duplicatesRemoved: inventory.duplicates,
  cloudflareAeo: cloudflareVerdict,
  protectedAbisSubmitted: protectedChecks.filter((p) => p.verdict.eligible).length,
  futureUrlsInEligible: futureInEligible,
  http404Sample: http404,
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('IndexNow Full-Site Safety Audit');
  console.log('Total discovered URLs:', report.totalDiscovered);
  console.log('Eligible IndexNow URLs:', report.eligible);
  console.log('Excluded future publishAt:', report.excludedFuturePublishAt);
  console.log('Excluded scheduled:', report.excludedScheduled);
  console.log('Excluded editorial_hold:', report.excludedEditorialHold);
  console.log('Excluded 404:', report.excluded404);
  console.log('Excluded noindex:', report.excludedNoindex);
  console.log('Excluded protected:', report.excludedProtected);
  console.log('Excluded private:', report.excludedPrivate);
  console.log('Excluded fixture/test:', report.excludedFixture);
  console.log('Duplicates removed:', report.duplicatesRemoved);
  console.log('');
  console.log(
    'Cloudflare AEO:',
    report.cloudflareAeo.eligible ? 'ISSUE' : `EXCLUDED (${report.cloudflareAeo.reason})`,
  );
  console.log('Protected ABIS submitted:', report.protectedAbisSubmitted);
  console.log('Future/scheduled in eligible:', report.futureUrlsInEligible);
  if (verifyHttp) console.log('HTTP 404 sample:', http404.join(', ') || 'none');
}

const exitBlocked =
  report.cloudflareAeo.eligible ||
  report.protectedAbisSubmitted > 0 ||
  report.futureUrlsInEligible > 0;

process.exit(exitBlocked ? 2 : 0);
