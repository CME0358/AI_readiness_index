#!/usr/bin/env node
/**
 * TMVU-03 — Apply internal link sections to published + scheduled non-ABIS insights.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyInternalLinksToHtml,
  getPublishedSlugsFromFilesystem,
  isProtectedInternalLinkSlug,
  loadSchedule,
  ROOT,
} from './lib/insights-related-links.mjs';

const dryRun = process.argv.includes('--dry-run');

function applyFile(htmlPath, slug, context) {
  const before = fs.readFileSync(htmlPath, 'utf8');
  const { html, changed, related } = applyInternalLinksToHtml(before, slug, context);
  if (changed && !dryRun) {
    fs.writeFileSync(htmlPath, html, 'utf8');
  }
  return { changed, related };
}

const schedule = loadSchedule();
let publishedCount = 0;
let scheduledCount = 0;

for (const slug of getPublishedSlugsFromFilesystem()) {
  if (isProtectedInternalLinkSlug(slug)) continue;
  const htmlPath = path.join(ROOT, 'insights', slug, 'index.html');
  const { changed } = applyFile(htmlPath, slug, { mode: 'published' });
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
  const entry = schedule.articles.find((a) => a.slug === slug);
  const { changed } = applyFile(htmlPath, slug, {
    mode: 'scheduled',
    publishAt: entry?.publishAt || null,
    schedule,
  });
  if (changed) scheduledCount++;
  console.log(`${dryRun ? '[dry-run] ' : ''}scheduled/${slug}: ${changed ? 'updated' : 'unchanged'}`);
}

console.log(
  `\nTMVU-03 apply complete. Published updated: ${publishedCount}, Scheduled updated: ${scheduledCount}${dryRun ? ' (dry-run)' : ''}.`,
);
