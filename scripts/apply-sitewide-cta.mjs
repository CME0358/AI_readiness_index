#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectInsightCta } from './lib/funnel/sitewide-cta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const insights = path.join(ROOT, 'insights');
const dirs = fs.readdirSync(insights, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name);

let changed = 0;
for (const slug of dirs) {
  const file = path.join(insights, slug, 'index.html');
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = injectInsightCta(before, slug);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
  }
}
console.log(`Applied site-wide CTA mapping to ${changed} Insights.`);
