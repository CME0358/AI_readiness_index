/**
 * Prepare scheduled article HTML on disk (sanitize + quality gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './insights-v2-paths.mjs';
import {
  sanitizeArticleHtmlFile,
  detectHtmlQualityIssues,
  assertPublishQuality,
} from './article-quality.mjs';
import { getScheduledSeoPackage, validateInsightSeo } from './insights-seo-package.mjs';
import {
  applyInternalLinksToHtml,
  assertInternalLinks,
  isProtectedInternalLinkSlug,
  loadSchedule,
} from './insights-related-links.mjs';
import { runPrepublishEditorialGate } from './prepublish-editorial-gate.mjs';
import { assertCanonicalInsightPresentation } from './insights-presentation.mjs';
import { syncInsightPublicationDate } from './insights-publication-date.mjs';

/**
 * @param {string} slug
 * @param {{ strict?: boolean, htmlPath?: string }} [opts]
 */
export function prepareScheduledArticle(slug, { strict = true, htmlPath = null } = {}) {
  const filePath = htmlPath || path.join(PATHS.scheduledDir, slug, 'index.html');
  if (!fs.existsSync(filePath)) {
    return { slug, ok: false, error: 'missing_html', changed: false };
  }

  const before = fs.readFileSync(filePath, 'utf8');
  let { html, changed, removed, issues } = sanitizeArticleHtmlFile(before, { slug });

  const schedule = loadSchedule();
  const entry = schedule.articles.find((a) => a.slug === slug);

  if (entry?.publishAt) {
    const dateSync = syncInsightPublicationDate(html, entry.publishAt);
    if (dateSync.changed) {
      html = dateSync.html;
      changed = true;
    }
  }

  if (!isProtectedInternalLinkSlug(slug)) {
    const linkResult = applyInternalLinksToHtml(html, slug, {
      mode: 'scheduled',
      publishAt: entry?.publishAt || null,
      schedule,
    });
    if (linkResult.changed) {
      html = linkResult.html;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
  }

  if (strict && issues.length) {
    return { slug, ok: false, error: 'quality_gate', changed, removed, issues };
  }

  if (strict) {
    try {
      assertPublishQuality(html, { slug });
      assertCanonicalInsightPresentation(html, { slug });
    } catch (err) {
      return { slug, ok: false, error: 'quality_gate', message: err.message, changed, removed, issues };
    }
    const seoPkg = getScheduledSeoPackage(slug);
    if (seoPkg) {
      const seoErrors = validateInsightSeo(html, slug, { scheduled: true });
      if (seoErrors.length) {
        return {
          slug,
          ok: false,
          error: 'seo_gate',
          message: seoErrors.join('; '),
          changed,
          removed,
          issues,
        };
      }
    }

    if (!isProtectedInternalLinkSlug(slug)) {
      try {
        assertInternalLinks(html, slug, {
          mode: 'scheduled',
          publishAt: entry?.publishAt || null,
          schedule,
        });
      } catch (err) {
        return {
          slug,
          ok: false,
          error: 'internal_links_gate',
          message: err.message,
          changed,
          removed,
          issues,
        };
      }
    }

    const editorialGate = runPrepublishEditorialGate(slug, {
      html,
      scheduleEntry: entry,
      schedule,
    });
    if (editorialGate.status === 'BLOCKED') {
      return {
        slug,
        ok: false,
        error: 'editorial_gate',
        message: editorialGate.blockers.map((b) => `${b.code}: ${b.message}`).join('; '),
        blockers: editorialGate.blockers,
        observations: editorialGate.observations,
        changed,
        removed,
        issues,
      };
    }
  }

  return {
    slug,
    ok: true,
    changed,
    removed,
    issuesBefore: detectHtmlQualityIssues(before, { slug }),
    issuesAfter: issues,
  };
}
