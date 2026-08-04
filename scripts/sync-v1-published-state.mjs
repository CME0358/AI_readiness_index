#!/usr/bin/env node
/**
 * Sync v1 schedule entries with remote publication evidence (HTTP 200).
 * Does not publish v2 articles. Does not call Buffer.
 *
 * Usage:
 *   node scripts/sync-v1-published-state.mjs
 *   node scripts/sync-v1-published-state.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleUrl } from './lib/insights-v2-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_PATH = path.join(ROOT, 'insights/_scheduled/schedule.json');
const INDEX_PATH = path.join(ROOT, 'insights/index.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const LLMS_PATH = path.join(ROOT, 'llms.txt');

const dryRun = process.argv.includes('--dry-run');

function dateParts(iso) {
  const d = new Date(iso);
  const y = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric' });
  const m = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', month: '2-digit' });
  const day = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', day: '2-digit' });
  return { ymd: `${y}-${m}-${day}`, dot: `${y}.${m}.${day}` };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function insertAfterMarker(content, marker, insertion) {
  if (!content.includes(marker)) throw new Error(`Marker not found: ${marker}`);
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

async function remoteStatus(slug) {
  const url = articleUrl(slug);
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const html = await r.text();
    return {
      slug,
      url,
      status: r.status,
      noindex: /noindex/i.test(html),
      canonical: (html.match(/rel="canonical"[^>]*href="([^"]+)"/i) || [])[1] || '',
      title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || '',
    };
  } catch (err) {
    return { slug, url, status: 0, error: String(err.message) };
  }
}

const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
const v1 = schedule.articles.filter((a) => a.series !== 'v2');

const report = [];
let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
let llms = fs.readFileSync(LLMS_PATH, 'utf8');
const synced = [];

for (const article of v1) {
  const remote = await remoteStatus(article.slug);
  const remotePublished = remote.status === 200 && !remote.noindex;
  let recommendedAction = 'manual_review';

  if (remotePublished) recommendedAction = 'mark_published';
  else if (remote.status === 404) recommendedAction = 'retain_scheduled';
  else if (remote.status === 200 && remote.noindex) recommendedAction = 'manual_review';
  else if (remote.status === 0) recommendedAction = 'manual_review';

  report.push({
    slug: article.slug,
    scheduledDate: article.publishAt,
    localStatus: article.status,
    remoteHttpStatus: remote.status,
    remotePublished,
    recommendedAction,
    remoteTitle: remote.title,
    canonical: remote.canonical,
  });

  if (recommendedAction !== 'mark_published') continue;
  if (article.status === 'published') continue;

  const src = path.join(ROOT, 'insights/_scheduled', article.slug);
  const dest = path.join(ROOT, 'insights', article.slug);
  const srcIndex = path.join(src, 'index.html');

  console.log(`${dryRun ? '[dry-run] ' : ''}Sync published: ${article.slug}`);

  if (!dryRun) {
    if (fs.existsSync(srcIndex) && !fs.existsSync(dest)) {
      fs.renameSync(src, dest);
    } else if (!fs.existsSync(dest)) {
      console.warn(`  Skip move — no local HTML at ${srcIndex}`);
    }
  }

  const { ymd } = dateParts(article.publishAt);
  if (!indexHtml.includes(`data-insight-slug="${article.slug}"`)) {
    indexHtml = insertAfterMarker(indexHtml, '<!-- INSIGHTS_CARDS_START -->', cardHtml(article));
  }
  indexHtml = removePlannedCard(indexHtml, article.slug);
  indexHtml = updateFooterDate(indexHtml, ymd);

  if (!sitemap.includes(`/insights/${article.slug}/`)) {
    sitemap = insertAfterMarker(sitemap, '<!-- INSIGHTS_URLS_START -->', sitemapEntry(article));
  }
  sitemap = updateInsightsLastmod(sitemap, ymd);

  if (!llms.includes(`/insights/${article.slug}/`)) {
    llms = insertAfterMarker(llms, '# INSIGHTS_LLMS_START', llmsLine(article));
  }

  article.status = 'published';
  article.publishedAt = article.publishAt;
  synced.push(article.slug);
}

if (!dryRun && synced.length) {
  fs.writeFileSync(INDEX_PATH, indexHtml, 'utf8');
  fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
  fs.writeFileSync(LLMS_PATH, llms, 'utf8');
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
}

const outPath = path.join(ROOT, 'reports/v1-sync-result.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ synced, report, dryRun }, null, 2) + '\n', 'utf8');

console.log('Synced:', synced.length, 'articles');
console.log('Report:', outPath);
