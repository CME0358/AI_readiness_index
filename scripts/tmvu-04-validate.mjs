#!/usr/bin/env node
/**
 * TMVU-04 — GA4 conversion measurement validation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  validateInsightGa4Tracking,
  reportAppHasReportStart,
} from './lib/insights-ga4-tracking.mjs';
import {
  getPublishedSlugsFromFilesystem,
  isProtectedInternalLinkSlug,
  PROTECTED_INTERNAL_LINK_SLUGS,
  ROOT,
} from './lib/insights-related-links.mjs';

const errors = [];
const reportPath = path.join(ROOT, 'report/src/agent-readiness-report.jsx');
const reportAnalyticsPath = path.join(ROOT, 'report/src/analytics.js');
const ga4Path = path.join(ROOT, 'assets/ga4.js');
const analyticsPath = path.join(ROOT, 'assets/analytics.js');

const ga4 = fs.readFileSync(ga4Path, 'utf8');
if (!ga4.includes('G-BS30YQY1N7')) errors.push('ga4.js: expected Measurement ID G-BS30YQY1N7');
if ((ga4.match(/gtag\('config'/g) || []).length !== 1) errors.push('ga4.js: duplicate gtag config');

const analytics = fs.readFileSync(analyticsPath, 'utf8');
for (const evt of ['insight_cta_framework', 'insight_cta_research', 'insight_cta_report']) {
  if (!analytics.includes(evt)) errors.push(`analytics.js: missing event ${evt}`);
}

const reportSource = fs.readFileSync(reportPath, 'utf8');
const reportAnalyticsSource = fs.readFileSync(reportAnalyticsPath, 'utf8');
if (!reportAppHasReportStart(reportSource, reportAnalyticsSource)) {
  errors.push('report app: missing report_start integration');
}
if (reportSource.match(/report_start/g)?.length && reportSource.includes('useEffect') && reportSource.includes('setStage("form")') && !reportSource.includes('trackReportStartOnce')) {
  errors.push('report app: report_start must not fire on page load');
}

let publishedOk = 0;
let scheduledOk = 0;

for (const slug of getPublishedSlugsFromFilesystem()) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  const html = fs.readFileSync(path.join(ROOT, 'insights', slug, 'index.html'), 'utf8');
  const errs = validateInsightGa4Tracking(html, slug);
  if (errs.length) errors.push(...errs);
  else publishedOk++;
}

for (const ent of fs.readdirSync(path.join(ROOT, 'insights/_scheduled'), { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const slug = ent.name;
  const htmlPath = path.join(ROOT, 'insights/_scheduled', slug, 'index.html');
  if (!fs.existsSync(htmlPath)) continue;
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (isProtectedInternalLinkSlug(slug)) {
    errors.push(...validateInsightGa4Tracking(html, slug));
    const baseline = (() => {
      try {
        return execSync(`git show HEAD:insights/_scheduled/${slug}/index.html`, {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      } catch {
        return null;
      }
    })();
    if (baseline !== null && baseline !== html) errors.push(`${slug}: protected ABIS file modified`);
    continue;
  }
  const errs = validateInsightGa4Tracking(html, slug);
  if (errs.length) errors.push(...errs);
  else scheduledOk++;
}

console.log(`TMVU-04 validation: ${errors.length ? 'FAIL' : 'PASS'}`);
console.log(`Published non-ABIS tracked: ${publishedOk}/23`);
console.log(`Scheduled non-ABIS tracked: ${scheduledOk}/20`);
console.log(`Protected ABIS slugs: ${PROTECTED_INTERNAL_LINK_SLUGS.size} (unchanged)`);

if (errors.length) {
  console.error('\nErrors:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}
