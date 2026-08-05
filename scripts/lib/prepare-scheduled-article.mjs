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
  const { html, changed, removed, issues } = sanitizeArticleHtmlFile(before, { slug });

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
  }

  if (strict && issues.length) {
    return { slug, ok: false, error: 'quality_gate', changed, removed, issues };
  }

  if (strict) {
    try {
      assertPublishQuality(html, { slug });
    } catch (err) {
      return { slug, ok: false, error: 'quality_gate', message: err.message, changed, removed, issues };
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
