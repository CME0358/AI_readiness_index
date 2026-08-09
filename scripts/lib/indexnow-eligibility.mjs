/**
 * IndexNow full-site eligibility — publication state over sitemap/navigation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import { PROTECTED_INTERNAL_LINK_SLUGS } from './insights-related-links.mjs';
import { INDEXNOW_BASE, validateIndexNowUrl } from './indexnow-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(__dirname, '../..');

const BLOCKED_STATIC_SUFFIXES = [
  '/research/thanks.html',
  '/whitepaper/2026/research/checkout.html',
  '/whitepaper/2026/research/download.html',
  '/whitepaper/2026/research/thanks.html',
  '/whitepaper/2026/handbook/checkout.html',
  '/whitepaper/2026/handbook/thanks.html',
];

/**
 * @param {string} url
 */
export function insightSlugFromIndexNowUrl(url) {
  const check = validateIndexNowUrl(url);
  if (!check.ok) return null;
  const m = check.url.match(/\/insights\/([^/]+)\/$/);
  return m ? m[1] : null;
}

/**
 * @param {string} sitemapXml
 */
export function parseSitemapLocs(sitemapXml) {
  return [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/**
 * @param {string} root
 */
export function loadScheduleArticles(root = DEFAULT_ROOT) {
  const p = path.join(root, 'insights/_scheduled/schedule.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8')).articles || [];
}

/**
 * @param {string} slug
 * @param {object[]} articles
 */
export function scheduleEntryForSlug(slug, articles) {
  return articles.find((a) => a.slug === slug) || null;
}

/**
 * @param {object|null} entry
 * @param {Date} [now]
 */
export function isFuturePublishAt(entry, now = new Date()) {
  if (!entry?.publishAt) return false;
  return new Date(entry.publishAt).getTime() > now.getTime();
}

/**
 * @param {string} localPath
 */
export function localHtmlHasNoindex(localPath) {
  if (!fs.existsSync(localPath)) return false;
  const html = fs.readFileSync(localPath, 'utf8');
  return /noindex/i.test(html) && /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);
}

/**
 * @param {string} url
 * @param {string} root
 */
export function localPathForPublicUrl(url, root = DEFAULT_ROOT) {
  const check = validateIndexNowUrl(url);
  if (!check.ok) return null;
  const u = new URL(check.url);
  let pathname = u.pathname;
  if (pathname.endsWith('/')) pathname += 'index.html';
  if (pathname.startsWith('/')) pathname = pathname.slice(1);
  return path.join(root, pathname);
}

/**
 * @param {string} url
 * @param {{ scheduleArticles?: object[], now?: Date, root?: string, requireLiveInsightFile?: boolean }} [ctx]
 */
export function classifyIndexNowCandidate(url, ctx = {}) {
  const {
    scheduleArticles = loadScheduleArticles(ctx.root),
    now = new Date(),
    root = DEFAULT_ROOT,
    requireLiveInsightFile = true,
  } = ctx;

  const format = validateIndexNowUrl(url);
  if (!format.ok) {
    return { eligible: false, reason: 'private', detail: format.error };
  }

  const normalized = format.url;

  for (const suffix of BLOCKED_STATIC_SUFFIXES) {
    if (normalized.includes(suffix)) {
      return { eligible: false, reason: 'private', detail: `blocked static path ${suffix}` };
    }
  }

  const slug = insightSlugFromIndexNowUrl(normalized);
  if (slug) {
    if (PROTECTED_INTERNAL_LINK_SLUGS.has(slug)) {
      return { eligible: false, reason: 'protected', detail: slug };
    }

    const entry = scheduleEntryForSlug(slug, scheduleArticles);
    if (entry) {
      if (entry.status === EDITORIAL_STATUSES.HOLD) {
        return { eligible: false, reason: 'editorial_hold', detail: slug };
      }
      if (entry.status === EDITORIAL_STATUSES.SCHEDULED) {
        if (isFuturePublishAt(entry, now)) {
          return { eligible: false, reason: 'future_publishAt', detail: entry.publishAt };
        }
        return { eligible: false, reason: 'scheduled', detail: slug };
      }
      if (entry.status !== EDITORIAL_STATUSES.PUBLISHED) {
        return { eligible: false, reason: 'unpublished', detail: `${slug}:${entry.status}` };
      }
    }

    const livePath = path.join(root, 'insights', slug, 'index.html');
    const schedPath = path.join(root, 'insights/_scheduled', slug, 'index.html');
    const hasHtml = fs.existsSync(livePath) || fs.existsSync(schedPath);
    if (requireLiveInsightFile && !hasHtml) {
      return { eligible: false, reason: '404', detail: slug };
    }
    const htmlPath = fs.existsSync(livePath) ? livePath : schedPath;
    if (localHtmlHasNoindex(htmlPath)) {
      return { eligible: false, reason: 'noindex', detail: slug };
    }

    return { eligible: true, reason: 'public', detail: slug };
  }

  const localPath = localPathForPublicUrl(normalized, root);
  if (localPath && localHtmlHasNoindex(localPath)) {
    return { eligible: false, reason: 'noindex', detail: localPath };
  }

  return { eligible: true, reason: 'public', detail: 'static' };
}

/**
 * @param {{ root?: string, scheduleArticles?: object[] }} [opts]
 */
export function discoverIndexNowCandidates(opts = {}) {
  const root = opts.root || DEFAULT_ROOT;
  const scheduleArticles = opts.scheduleArticles || loadScheduleArticles(root);
  const discovered = new Set();

  const sitemapPath = path.join(root, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    for (const loc of parseSitemapLocs(fs.readFileSync(sitemapPath, 'utf8'))) {
      discovered.add(loc);
    }
  }

  for (const entry of scheduleArticles) {
    discovered.add(`${INDEXNOW_BASE}/insights/${entry.slug}/`);
  }

  return [...discovered];
}

/**
 * @param {string[]} urls
 * @param {{ scheduleArticles?: object[], now?: Date, root?: string, requireLiveInsightFile?: boolean }} [ctx]
 */
export function partitionIndexNowCandidates(urls, ctx = {}) {
  const eligible = [];
  const excluded = [];
  const seen = new Set();
  let duplicates = 0;

  for (const raw of urls) {
    const check = validateIndexNowUrl(raw);
    const key = check.ok ? check.url : raw;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    const verdict = classifyIndexNowCandidate(raw, ctx);
    if (verdict.eligible) {
      eligible.push(check.ok ? check.url : raw);
    } else {
      excluded.push({ url: raw, ...verdict });
    }
  }

  return { eligible, excluded, duplicates };
}

/**
 * @param {{ root?: string, now?: Date, requireLiveInsightFile?: boolean }} [opts]
 */
export function collectIndexNowEligibleUrls(opts = {}) {
  const discovered = discoverIndexNowCandidates(opts);
  const { eligible, excluded, duplicates } = partitionIndexNowCandidates(discovered, opts);
  return {
    discovered: discovered.length,
    eligible,
    excluded,
    duplicates,
  };
}

/**
 * @param {string[]} urls
 * @param {object} ctx
 */
export function assertIndexNowSubmissionSafe(urls, ctx = {}) {
  const { eligible, excluded } = partitionIndexNowCandidates(urls, ctx);
  if (excluded.length) {
    return {
      ok: false,
      eligible,
      excluded,
      message: `${excluded.length} URL(s) blocked by IndexNow eligibility gate`,
    };
  }
  return { ok: true, eligible, excluded: [] };
}

/**
 * @param {object[]} excluded
 */
export function summarizeIndexNowExclusions(excluded) {
  const counts = {
    future_publishAt: 0,
    scheduled: 0,
    editorial_hold: 0,
    '404': 0,
    noindex: 0,
    protected: 0,
    private: 0,
    unpublished: 0,
    fixture: 0,
  };
  for (const item of excluded) {
    const key = item.reason in counts ? item.reason : 'private';
    counts[key] += 1;
  }
  return counts;
}
