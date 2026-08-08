#!/usr/bin/env node
/**
 * Publish due Insights columns from insights/_scheduled/ to insights/{slug}/,
 * and update index.html / sitemap.xml / llms.txt.
 *
 * Usage:
 *   node scripts/publish-scheduled-insights.mjs
 *   node scripts/publish-scheduled-insights.mjs --dry-run
 *   node scripts/publish-scheduled-insights.mjs --force-slug files
 *   node scripts/publish-scheduled-insights.mjs --now 2026-07-13T10:00:00+09:00
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDueArticles } from './lib/editorial-status.mjs';
import { prepareScheduledArticle } from './lib/prepare-scheduled-article.mjs';
import { isWeekday } from './lib/business-days.mjs';
import { publishedUrlsFromSlugs, submitIndexNow } from './lib/indexnow-client.mjs';
import { isProtectedInternalLinkSlug } from './lib/insights-related-links.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_PATH = path.join(ROOT, 'insights/_scheduled/schedule.json');
const INDEX_PATH = path.join(ROOT, 'insights/index.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const LLMS_PATH = path.join(ROOT, 'llms.txt');

const dryRun = process.argv.includes('--dry-run');
const forceSlug = (() => {
  const i = process.argv.indexOf('--force-slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const nowArg = (() => {
  const i = process.argv.indexOf('--now');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('Invalid --now value');
  process.exit(1);
}

if (!forceSlug && !isWeekday(now)) {
  console.log('Weekend — no publish.', { now: now.toISOString() });
  process.exit(0);
}

const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
const due = extractDueArticles(schedule.articles, now, forceSlug);

if (!due.length) {
  console.log('No scheduled articles due.', { now: now.toISOString() });
  process.exit(0);
}

function dateParts(iso) {
  const d = new Date(iso);
  const y = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric' });
  const m = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', month: '2-digit' });
  const day = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', day: '2-digit' });
  return { ymd: `${y}-${m}-${day}`, dot: `${y}.${m}.${day}` };
}

function cardHtml(article) {
  const { ymd, dot } = dateParts(article.publishAt);
  return `      <a class="insight-card" href="/insights/${article.slug}/" data-insight-slug="${article.slug}">
        <div class="insight-meta">
          <time datetime="${ymd}">${dot}</time>
          <span class="insight-tag">Column</span>
        </div>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.cardSummary)}</p>
        <span class="read-more">続きを読む →</span>
      </a>
`;
}

function sitemapEntry(article) {
  const { ymd } = dateParts(article.publishAt);
  return `  <url>
    <loc>https://readiness.coaretail.com/insights/${article.slug}/</loc>
    <lastmod>${ymd}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
}

function llmsLine(article) {
  const { ymd } = dateParts(article.publishAt);
  return `- [${article.llmsLabel}](https://readiness.coaretail.com/insights/${article.slug}/): Insights Column（${ymd}）
`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function insertAfterMarker(content, marker, insertion) {
  if (!content.includes(marker)) {
    throw new Error(`Marker not found: ${marker}`);
  }
  // Insert immediately after the marker line
  return content.replace(marker, `${marker}\n${insertion.replace(/\n$/, '')}`);
}

function removePlannedCard(indexHtml, slug) {
  const re = new RegExp(
    `\\s*<article class="insight-card planned"[^>]*data-scheduled-slug="${slug}"[\\s\\S]*?</article>`,
    'g'
  );
  return indexHtml.replace(re, '');
}

function updateFooterDate(content, ymd) {
  return content.replace(
    /Version 1\.0 · Last Updated \d{4}-\d{2}-\d{2}/,
    `Version 1.0 · Last Updated ${ymd}`
  );
}

function updateInsightsLastmod(sitemap, ymd) {
  return sitemap.replace(
    /(<loc>https:\/\/readiness\.coaretail\.com\/insights\/<\/loc>\s*<lastmod>)\d{4}-\d{2}-\d{2}/,
    `$1${ymd}`
  );
}

/** @param {string[]} slugs */
async function notifyIndexNow(slugs) {
  if (!slugs.length) return;
  const urls = publishedUrlsFromSlugs(slugs);
  await submitIndexNow(urls, { dryRun });
}

let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
let llms = fs.readFileSync(LLMS_PATH, 'utf8');

// Oldest first: each insert goes right after the marker, so the newest ends up on top
const ordered = [...due].sort(
  (a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime()
);

const published = [];

for (const article of ordered) {
  if (isProtectedInternalLinkSlug(article.slug)) {
    console.error('TMVU-05 BLOCKED: Protected ABIS article cannot be published:', article.slug);
    console.error('Reason: PROTECTED_ABIS_PREPUBLICATION');
    process.exit(1);
  }

  const src = path.join(ROOT, 'insights/_scheduled', article.slug);
  const dest = path.join(ROOT, 'insights', article.slug);
  const srcIndex = path.join(src, 'index.html');

  if (!fs.existsSync(srcIndex)) {
    console.error('Missing scheduled article:', srcIndex);
    process.exit(1);
  }

  const prepared = prepareScheduledArticle(article.slug, { strict: true });
  if (!prepared.ok) {
    console.error('TMVU-05 publish gate failed:', article.slug, prepared.error || 'unknown');
    if (prepared.blockers?.length) {
      for (const b of prepared.blockers) console.error(`  - ${b.code}: ${b.message}`);
    } else if (prepared.message) {
      console.error(`  - ${prepared.message}`);
    }
    process.exit(1);
  }
  if (prepared.changed) {
    console.log(`Prepared ${article.slug}: ${prepared.removed?.join(', ') || 'sanitized'}`);
  }

  if (fs.existsSync(dest)) {
    console.error('Destination already exists:', dest);
    process.exit(1);
  }

  const { ymd } = dateParts(article.publishAt);
  console.log(`${dryRun ? '[dry-run] ' : ''}Publish ${article.slug} (${article.publishAt})`);

  if (!dryRun) {
    fs.renameSync(src, dest);
  }

  // Avoid duplicate inserts
  if (!indexHtml.includes(`data-insight-slug="${article.slug}"`)) {
    indexHtml = insertAfterMarker(
      indexHtml,
      '<!-- INSIGHTS_CARDS_START -->',
      cardHtml(article)
    );
  }
  indexHtml = removePlannedCard(indexHtml, article.slug);
  indexHtml = updateFooterDate(indexHtml, ymd);

  if (!sitemap.includes(`/insights/${article.slug}/`)) {
    sitemap = insertAfterMarker(
      sitemap,
      '<!-- INSIGHTS_URLS_START -->',
      sitemapEntry(article)
    );
  }
  sitemap = updateInsightsLastmod(sitemap, ymd);

  if (!llms.includes(`/insights/${article.slug}/`)) {
    llms = insertAfterMarker(llms, '# INSIGHTS_LLMS_START', llmsLine(article));
  }

  const entry = schedule.articles.find((a) => a.slug === article.slug);
  if (entry) {
    entry.status = 'published';
    entry.publishedAt = now.toISOString();
  }
  published.push(article.slug);
}

if (dryRun) {
  await notifyIndexNow(published);
  console.log('Dry run complete. Would publish:', published.join(', '));
  process.exit(0);
}

fs.writeFileSync(INDEX_PATH, indexHtml, 'utf8');
fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
fs.writeFileSync(LLMS_PATH, llms, 'utf8');
fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n', 'utf8');

await notifyIndexNow(published);

console.log('Published:', published.join(', '));
console.log('UPDATED=1');
