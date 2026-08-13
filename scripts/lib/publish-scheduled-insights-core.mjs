/**
 * Core publish logic extracted for reconciliation + CLI reuse.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT } from './insights-v2-paths.mjs';
import { extractDueArticles } from './editorial-status.mjs';
import { prepareScheduledArticle } from './prepare-scheduled-article.mjs';
import { isWeekday } from './business-days.mjs';
import { isProtectedInternalLinkSlug } from './insights-related-links.mjs';
import { enrollSocialOnPublish } from './enroll-social-on-publish.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import {
  isArticlePublishedOnDisk,
  articleDestPath,
} from './publishing-state-machine.mjs';

const SCHEDULE_PATH = PATHS.schedule;
const INDEX_PATH = PATHS.insightsIndex;
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const LLMS_PATH = path.join(ROOT, 'llms.txt');

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

/**
 * Sync schedule entry when article exists on disk but schedule still says scheduled.
 */
export function recoverPublishedScheduleEntry(schedule, slug, now = new Date()) {
  const entry = schedule.articles.find((a) => a.slug === slug);
  if (!entry || !isArticlePublishedOnDisk(slug)) return { recovered: false };
  if (entry.status === EDITORIAL_STATUSES.PUBLISHED) return { recovered: false, slug };
  entry.status = EDITORIAL_STATUSES.PUBLISHED;
  entry.publishedAt = entry.publishedAt || now.toISOString();
  return { recovered: true, slug };
}

/**
 * @returns {{ updated: boolean, published: string[], skipped: string[], errors: string[] }}
 */
export function publishDueArticles({
  now = new Date(),
  forceSlug = null,
  dryRun = false,
  allowWeekend = false,
} = {}) {
  const result = { updated: false, published: [], skipped: [], errors: [] };

  if (!forceSlug && !allowWeekend && !isWeekday(now)) {
    return { ...result, reason: 'weekend' };
  }

  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const due = extractDueArticles(schedule.articles, now, forceSlug);

  if (!due.length) {
    return result;
  }

  let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  let llms = fs.readFileSync(LLMS_PATH, 'utf8');

  const ordered = [...due].sort(
    (a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime()
  );

  for (const article of ordered) {
    const dest = articleDestPath(article.slug);

    if (isArticlePublishedOnDisk(article.slug)) {
      const entry = schedule.articles.find((a) => a.slug === article.slug);
      if (entry && entry.status !== EDITORIAL_STATUSES.PUBLISHED) {
        entry.status = EDITORIAL_STATUSES.PUBLISHED;
        entry.publishedAt = entry.publishedAt || now.toISOString();
        result.updated = true;
      }
      result.skipped.push(article.slug);
      continue;
    }

    if (isProtectedInternalLinkSlug(article.slug)) {
      result.errors.push(`PROTECTED_ABIS:${article.slug}`);
      continue;
    }

    const src = path.join(ROOT, 'insights/_scheduled', article.slug);
    const srcIndex = path.join(src, 'index.html');

    if (!fs.existsSync(srcIndex)) {
      result.errors.push(`missing_scheduled_html:${article.slug}`);
      continue;
    }

    const prepared = prepareScheduledArticle(article.slug, { strict: true });
    if (!prepared.ok) {
      result.errors.push(`quality_gate:${article.slug}`);
      continue;
    }

    const { ymd } = dateParts(article.publishAt);

    if (!dryRun) {
      fs.renameSync(src, dest);
    }

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

    const entry = schedule.articles.find((a) => a.slug === article.slug);
    if (entry) {
      entry.status = EDITORIAL_STATUSES.PUBLISHED;
      entry.publishedAt = now.toISOString();
      if (!dryRun) {
        const social = enrollSocialOnPublish(entry);
        if (social.enrolled) {
          result.socialEnrolled = result.socialEnrolled || [];
          result.socialEnrolled.push(entry.slug);
        }
      }
    }

    result.published.push(article.slug);
    result.updated = true;
  }

  if (result.updated && !dryRun) {
    fs.writeFileSync(INDEX_PATH, indexHtml, 'utf8');
    fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
    fs.writeFileSync(LLMS_PATH, llms, 'utf8');
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
  }

  return result;
}
