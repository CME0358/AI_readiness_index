#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectInsightCta } from './lib/funnel/sitewide-cta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const insights = path.join(ROOT, 'insights');
const injectBlock = process.argv.includes('--inject-blocks');

function insightTargets() {
  const targets = [];
  for (const entry of fs.readdirSync(insights, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_scheduled') {
      for (const nested of fs.readdirSync(path.join(insights, entry.name), { withFileTypes: true })) {
        if (!nested.isDirectory()) continue;
        const file = path.join(insights, entry.name, nested.name, 'index.html');
        if (fs.existsSync(file)) targets.push({ slug: nested.name, file });
      }
      continue;
    }
    if (entry.name.startsWith('_')) continue;
    const file = path.join(insights, entry.name, 'index.html');
    if (fs.existsSync(file)) targets.push({ slug: entry.name, file });
  }
  return targets;
}

let changed = 0;
for (const { slug, file } of insightTargets()) {
  const before = fs.readFileSync(file, 'utf8');
  const after = injectInsightCta(before, slug, null, { injectBlock });
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
  }
}
console.log(`Applied site-wide CTA mapping to ${changed} Insights.`);
