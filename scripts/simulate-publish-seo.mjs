#!/usr/bin/env node
/**
 * TMVU-01B PHASE 23 — Local publish simulation (no status / filesystem publish).
 * Copies one scheduled article to a temp dir and validates SEO metadata survives prepare step.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { prepareScheduledArticle } from './lib/prepare-scheduled-article.mjs';
import { validateInsightSeo } from './lib/insights-seo-package.mjs';

const slug = process.argv[2] || 'three-pillars-ops';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(ROOT, 'insights/_scheduled', slug, 'index.html');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tmvu-01b-publish-'));
const tmpHtml = path.join(tmpRoot, slug, 'index.html');

if (!fs.existsSync(src)) {
  console.error('Missing scheduled article:', src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(tmpHtml), { recursive: true });
fs.copyFileSync(src, tmpHtml);

const prepared = prepareScheduledArticle(slug, { strict: true, htmlPath: tmpHtml });
if (!prepared.ok) {
  console.error('Prepare failed:', prepared);
  process.exit(1);
}

const html = fs.readFileSync(tmpHtml, 'utf8');
const errors = validateInsightSeo(html, slug, { scheduled: true });
if (errors.length) {
  console.error('Post-prepare SEO errors:', errors);
  process.exit(1);
}

console.log(`Publish simulation OK: ${slug}`);
console.log(`Temp copy: ${tmpHtml}`);
console.log('SEO metadata preserved after prepareScheduledArticle.');
