/**
 * TMVU-04 — GA4 CTA tracking markup for Insights HTML.
 */
import { isProtectedInternalLinkSlug } from './insights-related-links.mjs';

const ANALYTICS_SCRIPT = '<script src="/assets/analytics.js" defer></script>';

const CTA_ATTRS = {
  '/framework/': 'framework',
  '/research/': 'research',
  '/report/': 'report',
};

function decodeHtmlEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function extractArticleMeta(html) {
  const slugMatch = html.match(/insights\/([^/"']+)\//);
  const h1 = decodeHtmlEntities(html.match(/<h1>([^<]+)<\/h1>/)?.[1] || '');
  return { h1 };
}

export function ensureAnalyticsScript(html) {
  if (html.includes('/assets/analytics.js')) return html;
  if (!html.includes('/assets/ga4.js')) return html;
  return html.replace(
    /<script src="\/assets\/ga4\.js" async><\/script>/,
    `<script src="/assets/ga4.js" async></script>\n${ANALYTICS_SCRIPT}`,
  );
}

export function applyInsightGa4Tracking(html, slug) {
  if (isProtectedInternalLinkSlug(slug)) {
    return { html, changed: false, skipped: 'protected' };
  }

  let out = ensureAnalyticsScript(html);
  const meta = extractArticleMeta(out);
  const title = meta.h1 || slug;

  if (!out.includes('data-article-slug=')) {
    out = out.replace(
      /<article class="article-body container">/,
      `<article class="article-body container" data-article-slug="${slug}" data-article-title="${escapeAttr(title)}">`,
    );
  }

  const ctaRe = /(<div class="article-cta">[\s\S]*?<\/div>)/;
  const ctaMatch = out.match(ctaRe);
  if (ctaMatch) {
    let ctaBlock = ctaMatch[1];
    for (const [href, ctaType] of Object.entries(CTA_ATTRS)) {
      const linkRe = new RegExp(
        `(<a href="${href.replace(/\//g, '\\/')}" class="btn[^"]*")([^>]*>)`,
        'g',
      );
      ctaBlock = ctaBlock.replace(linkRe, (full, prefix, suffix) => {
        if (full.includes('data-ga-insight-cta')) return full;
        return `${prefix} data-ga-insight-cta="${ctaType}"${suffix}`;
      });
    }
    out = out.replace(ctaMatch[1], ctaBlock);
  }

  return { html: out, changed: out !== html };
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function validateInsightGa4Tracking(html, slug) {
  const errors = [];
  if (isProtectedInternalLinkSlug(slug)) {
    if (html.includes('data-ga-insight-cta')) errors.push(`${slug}: protected must not have GA CTA attrs`);
    if (html.includes('/assets/analytics.js')) errors.push(`${slug}: protected must not load analytics.js`);
    return errors;
  }

  if (!html.includes('/assets/analytics.js')) errors.push(`${slug}: missing analytics.js`);
  if (!html.includes(`data-article-slug="${slug}"`)) errors.push(`${slug}: missing data-article-slug`);

  const ctaMatch = html.match(/<div class="article-cta">([\s\S]*?)<\/div>/);
  if (!ctaMatch) {
    errors.push(`${slug}: missing article-cta`);
    return errors;
  }

  const cta = ctaMatch[1];
  for (const [href, ctaType] of Object.entries(CTA_ATTRS)) {
    if (!cta.includes(`href="${href}"`)) errors.push(`${slug}: missing CTA ${href}`);
    else if (!cta.includes(`data-ga-insight-cta="${ctaType}"`)) {
      errors.push(`${slug}: missing data-ga-insight-cta="${ctaType}"`);
    }
  }

  return errors;
}

export function reportAppHasReportStart(reportSource, analyticsReportSource = '') {
  const jsxOk =
    reportSource.includes('trackReportStartOnce') &&
    reportSource.includes('handleStart');
  const analyticsOk =
    analyticsReportSource.includes("'report_start'") ||
    analyticsReportSource.includes('"report_start"');
  return jsxOk && (analyticsReportSource ? analyticsOk : true);
}
