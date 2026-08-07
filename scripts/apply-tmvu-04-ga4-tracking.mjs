#!/usr/bin/env node
/**
 * TMVU-04 — Apply GA4 CTA tracking to published + scheduled non-ABIS insights.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyInsightGa4Tracking,
} from './lib/insights-ga4-tracking.mjs';
import {
  getPublishedSlugsFromFilesystem,
  isProtectedInternalLinkSlug,
  ROOT,
} from './lib/insights-related-links.mjs';

const dryRun = process.argv.includes('--dry-run');

function applyFile(htmlPath, slug) {
  const before = fs.readFileSync(htmlPath, 'utf8');
  const { html, changed, skipped } = applyInsightGa4Tracking(before, slug);
  if (changed && !dryRun) fs.writeFileSync(htmlPath, html, 'utf8');
  return { changed: !!changed, skipped };
}

let publishedCount = 0;
let scheduledCount = 0;

for (const slug of getPublishedSlugsFromFilesystem()) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  const htmlPath = path.join(ROOT, 'insights', slug, 'index.html');
  const { changed } = applyFile(htmlPath, slug);
  if (changed) publishedCount++;
  console.log(`${dryRun ? '[dry-run] ' : ''}published/${slug}: ${changed ? 'updated' : 'unchanged'}`);
}

for (const ent of fs.readdirSync(path.join(ROOT, 'insights/_scheduled'), { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const slug = ent.name;
  if (isProtectedInternalLinkSlug(slug)) {
    console.log(`scheduled/${slug}: PROTECTED (skipped)`);
    continue;
  }
  const htmlPath = path.join(ROOT, 'insights/_scheduled', slug, 'index.html');
  if (!fs.existsSync(htmlPath)) continue;
  const { changed } = applyFile(htmlPath, slug);
  if (changed) scheduledCount++;
  console.log(`${dryRun ? '[dry-run] ' : ''}scheduled/${slug}: ${changed ? 'updated' : 'unchanged'}`);
}

console.log(
  `\nTMVU-04 apply complete. Published: ${publishedCount}, Scheduled: ${scheduledCount}${dryRun ? ' (dry-run)' : ''}.`,
);
