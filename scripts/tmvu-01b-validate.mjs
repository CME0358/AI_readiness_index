#!/usr/bin/env node
/** TMVU-01B PHASE 19 — SEO validation for scheduled insights. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEDULED_SEO_PACKAGES, validateInsightSeo } from './lib/insights-seo-package.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEDULED = path.join(ROOT, 'insights/_scheduled');

const PUBLISHED_SLUGS = fs
  .readdirSync(path.join(ROOT, 'insights'))
  .filter((d) => {
    const p = path.join(ROOT, 'insights', d);
    return fs.statSync(p).isDirectory() && !d.startsWith('_') && fs.existsSync(path.join(p, 'index.html'));
  })
  .sort();

const slugs = Object.keys(SCHEDULED_SEO_PACKAGES).sort();
const errors = [];
const warnings = [];

for (const slug of slugs) {
  const filePath = path.join(SCHEDULED, slug, 'index.html');
  if (!fs.existsSync(filePath)) {
    errors.push(`${slug}: missing scheduled HTML`);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  errors.push(...validateInsightSeo(html, slug, { scheduled: true }));
}

console.log(`Validated ${slugs.length} scheduled insights (TMVU-01B).`);
if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log('  -', w));
}
if (errors.length) {
  console.error('\nErrors:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}
console.log('\nAll scheduled SEO checks passed.');
console.log(`Published insights untouched: ${PUBLISHED_SLUGS.length} slugs under insights/ (not validated here).`);
