#!/usr/bin/env node
/**
 * TMVU-01B — Apply SEO packages to insights/_scheduled/ HTML and sync metadata sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEDULED_SEO_PACKAGES,
  applySeoPackageToHtml,
  getScheduledSeoPackage,
} from './lib/insights-seo-package.mjs';
import { PATHS } from './lib/insights-v2-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEDULED = path.join(ROOT, 'insights/_scheduled');

let updated = 0;
for (const slug of Object.keys(SCHEDULED_SEO_PACKAGES).sort()) {
  const pkg = getScheduledSeoPackage(slug);
  const filePath = path.join(SCHEDULED, slug, 'index.html');
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP missing HTML: ${slug}`);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  const out = applySeoPackageToHtml(html, slug, pkg);
  fs.writeFileSync(filePath, out, 'utf8');
  updated += 1;
  console.log(`OK ${slug} [${pkg.intent}]`);
}

const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
let scheduleSynced = 0;
for (const entry of schedule.articles) {
  const pkg = getScheduledSeoPackage(entry.slug);
  if (!pkg) continue;
  entry.seoTitle = pkg.h1;
  entry.metaDescription = pkg.meta;
  entry.searchIntentClass = pkg.intent;
  entry.primarySearchIntent = pkg.primarySearchIntent;
  scheduleSynced += 1;
}
fs.writeFileSync(PATHS.schedule, JSON.stringify(schedule, null, 2) + '\n', 'utf8');

if (fs.existsSync(PATHS.articleMeta)) {
  const meta = JSON.parse(fs.readFileSync(PATHS.articleMeta, 'utf8'));
  for (const slug of Object.keys(SCHEDULED_SEO_PACKAGES)) {
    const pkg = getScheduledSeoPackage(slug);
    if (!meta.articles[slug]) continue;
    meta.articles[slug].seoTitle = pkg.h1;
    meta.articles[slug].metaDescription = pkg.meta;
    meta.articles[slug].searchIntentClass = pkg.intent;
    meta.articles[slug].primarySearchIntent = pkg.primarySearchIntent;
    meta.articles[slug].desc = pkg.meta;
    meta.articles[slug].lead = pkg.lead;
    meta.articles[slug].crumb = pkg.breadcrumb;
  }
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(PATHS.articleMeta, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

console.log(`\nUpdated ${updated} scheduled HTML files.`);
console.log(`Synced SEO fields on ${scheduleSynced} schedule.json entries.`);
