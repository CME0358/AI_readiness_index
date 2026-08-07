#!/usr/bin/env node
/** TMVU-01A PHASE 14 — post-retrofit validation for published insights. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSIGHTS = path.join(ROOT, 'insights');

const slugs = fs
  .readdirSync(INSIGHTS)
  .filter((d) => {
    const p = path.join(INSIGHTS, d);
    return fs.statSync(p).isDirectory() && !d.startsWith('_') && fs.existsSync(path.join(p, 'index.html'));
  })
  .sort();

const errors = [];
const warnings = [];

function count(html, re) {
  return (html.match(re) || []).length;
}

for (const slug of slugs) {
  const html = fs.readFileSync(path.join(INSIGHTS, slug, 'index.html'), 'utf8');
  const canon = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  const expectedCanon = `https://readiness.coaretail.com/insights/${slug}/`;
  const expectedOgUrl = expectedCanon;

  const checks = [
    [count(html, /<title>/g) === 1, 'title count'],
    [count(html, /name="description"/g) === 1, 'meta description count'],
    [count(html, /rel="canonical"/g) === 1, 'canonical count'],
    [canon === expectedCanon, `canonical URL (${canon})`],
    [count(html, /property="og:title"/g) === 1, 'og:title count'],
    [count(html, /property="og:description"/g) === 1, 'og:description count'],
    [count(html, /property="og:type"/g) === 1, 'og:type count'],
    [html.includes(`property="og:url" content="${expectedOgUrl}"`), 'og:url'],
    [html.includes('property="og:site_name" content="Agent Readiness Research Hub"'), 'og:site_name'],
    [count(html, /name="twitter:title"/g) === 1, 'twitter:title count'],
    [count(html, /name="twitter:description"/g) === 1, 'twitter:description count'],
    [count(html, /name="twitter:card"/g) === 1, 'twitter:card count'],
    [count(html, /<h1>/g) === 1, 'h1 count'],
    [html.includes('/framework/'), 'framework link'],
    [html.includes('/research/'), 'research link'],
    [html.includes('/report/'), 'report link'],
  ];

  for (const [ok, label] of checks) {
    if (!ok) errors.push(`${slug}: ${label}`);
  }

  const jsonMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/);
  if (!jsonMatch) {
    errors.push(`${slug}: missing JSON-LD`);
  } else {
    try {
      const ld = JSON.parse(jsonMatch[1]);
      if (ld['@type'] !== 'BlogPosting') errors.push(`${slug}: JSON-LD not BlogPosting`);
      const h1 = html.match(/<h1>([^<]+)<\/h1>/)?.[1];
      const meta = html.match(/name="description" content="([^"]+)"/)?.[1];
      if (ld.headline !== h1) errors.push(`${slug}: headline≠h1`);
      if (ld.description !== meta) errors.push(`${slug}: json description≠meta`);
      if (ld.mainEntityOfPage !== expectedCanon) errors.push(`${slug}: mainEntityOfPage mismatch`);
    } catch (e) {
      errors.push(`${slug}: invalid JSON-LD — ${e.message}`);
    }
  }

  const lead = html.match(/<p class="lead">([^<]+)/)?.[1] || '';
  if ([...lead].length < 40) warnings.push(`${slug}: lead very short (${[...lead].length})`);
}

console.log(`Validated ${slugs.length} published insights.`);
if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log('  -', w));
}
if (errors.length) {
  console.error('\nErrors:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}
console.log('\nAll validation checks passed.');
