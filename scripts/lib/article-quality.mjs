/**
 * Detect and remove v5 batch boilerplate duplication in Insight article HTML.
 */

export const BOILERPLATE_TAIL =
  '定点観測と更新ログの運用が、Readiness改善の出発点になります。';

/** H2 sections appended by the v5 batch bug — safe to strip after the first まとめ. */
export const BOILERPLATE_H2_TITLES = new Set([
  '次の一手',
  '実務チェック',
  '情報設計の原則',
  '引用と実行のギャップ診断',
  '横断KPIの設計',
  '段階別の整備ポイント',
  '推薦プロセスの自己診断',
]);

const KEEP_AFTER_SUMMARY = new Set(['関連するInsights', '関連する Insight', '関連Insights']);

const BLOCK_RE =
  /(\s*<h2>([^<]*)<\/h2>(?:\s*<h3>[^<]*<\/h3>|\s*<p>[\s\S]*?<\/p>|\s*<ul>[\s\S]*?<\/ul>|\s*<blockquote>[\s\S]*?<\/blockquote>)*)+/g;

function stripHtmlTags(s) {
  return s.replace(/<[^>]+>/g, '').trim();
}

/**
 * @param {string} html Full index.html or article-container inner HTML
 * @param {{ slug?: string }} [opts]
 */
export function detectHtmlQualityIssues(html, { slug } = {}) {
  const issues = [];
  const tailCount = (html.match(new RegExp(escapeRegExp(BOILERPLATE_TAIL), 'g')) || []).length;
  if (tailCount > 0) {
    issues.push({ code: 'boilerplate_tail', count: tailCount });
  }

  const summaryMatches = html.match(/<h2>まとめ[^<]*<\/h2>/g) || [];
  if (summaryMatches.length > 1) {
    issues.push({ code: 'duplicate_summary_h2', count: summaryMatches.length });
  }

  if (slug && html.includes(`${slug}の要点は`)) {
    issues.push({ code: 'slug_boilerplate_summary' });
  }

  for (const title of BOILERPLATE_H2_TITLES) {
    if (html.includes(`<h2>${title}</h2>`)) {
      issues.push({ code: 'boilerplate_h2', title });
    }
  }

  return issues;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize inner HTML of article-container (or full page — CTA marker detected).
 * @returns {{ html: string, changed: boolean, removed: string[] }}
 */
export function sanitizeArticleBodyHtml(bodyHtml, { slug } = {}) {
  let html = bodyHtml;
  const removed = [];

  const tailRe = new RegExp(`\\s*<p>${escapeRegExp(BOILERPLATE_TAIL)}</p>\\n?`, 'g');
  const tailBefore = (html.match(tailRe) || []).length;
  if (tailBefore > 0) {
    html = html.replace(tailRe, '\n');
    removed.push(`boilerplate_tail×${tailBefore}`);
  }

  const ctaIdx = html.indexOf('<div class="article-cta">');
  const bodyPart = ctaIdx >= 0 ? html.slice(0, ctaIdx) : html;
  const tailPart = ctaIdx >= 0 ? html.slice(ctaIdx) : '';

  const sections = [];
  const sectionRe =
    /<h2>([^<]*)<\/h2>((?:\s*<h3>[\s\S]*?<\/h3>|\s*<p>[\s\S]*?<\/p>|\s*<ul>[\s\S]*?<\/ul>|\s*<blockquote>[\s\S]*?<\/blockquote>)*)/g;
  let preamble = '';
  let lastIndex = 0;
  let match;
  while ((match = sectionRe.exec(bodyPart)) !== null) {
    if (match.index > lastIndex) {
      preamble += bodyPart.slice(lastIndex, match.index);
    }
    sections.push({ title: match[1].trim(), block: match[0] });
    lastIndex = sectionRe.lastIndex;
  }
  let trailing = bodyPart.slice(lastIndex);
  trailing = trailing.replace(tailRe, '').trim();
  if (trailing && !/^<div class="article-cta">/.test(trailing)) {
    preamble += trailing;
  }

  if (!sections.length) {
    return { html, changed: removed.length > 0, removed };
  }

  preamble = preamble.trim() ? `${preamble.trimEnd()}\n` : '';

  let summarySeen = false;
  const kept = [];

  for (const sec of sections) {
    const isSummary = sec.title.startsWith('まとめ');
    const isBoilerplateH2 = BOILERPLATE_H2_TITLES.has(sec.title);
    const isSlugSummary =
      slug && isSummary && stripHtmlTags(sec.block).includes(`${slug}の要点は`);

    if (isSlugSummary || isBoilerplateH2) {
      removed.push(`section:${sec.title}`);
      continue;
    }

    if (isSummary) {
      if (summarySeen) {
        removed.push(`duplicate_summary:${sec.title}`);
        continue;
      }
      summarySeen = true;
      kept.push(sec.block);
      continue;
    }

    if (summarySeen && !KEEP_AFTER_SUMMARY.has(sec.title)) {
      // Post-summary sections before CTA are usually v5 batch padding unless whitelisted.
      removed.push(`post_summary:${sec.title}`);
      continue;
    }

    kept.push(sec.block);
  }

  const rebuilt = `${preamble.trimEnd()}${kept.length ? `\n${kept.join('\n')}\n` : ''}${tailPart}`;
  const changed = removed.length > 0 || rebuilt !== bodyHtml;
  return { html: rebuilt, changed, removed };
}

/**
 * Sanitize a full index.html file in place.
 * @param {string} html
 * @param {{ slug?: string }} [opts]
 */
export function sanitizeArticleHtmlFile(html, { slug } = {}) {
  const articleStart = html.indexOf('<article class="article-body');
  if (articleStart < 0) {
    return { html, changed: false, removed: [], issues: detectHtmlQualityIssues(html, { slug }) };
  }
  const articleEnd = html.indexOf('</article>', articleStart);
  const articleSlice =
    articleEnd >= 0 ? html.slice(articleStart, articleEnd) : html.slice(articleStart);

  const startMarker = '<div class="article-container">';
  const endMarker = '<div class="article-cta">';
  const start = articleSlice.indexOf(startMarker);
  const end = articleSlice.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    return { html, changed: false, removed: [], issues: detectHtmlQualityIssues(html, { slug }) };
  }

  const absStart = articleStart + start + startMarker.length;
  const absEnd = articleStart + end;
  const body = html.slice(absStart, absEnd);
  const { html: cleanedBody, changed, removed } = sanitizeArticleBodyHtml(body, { slug });
  const out = `${html.slice(0, absStart)}\n${cleanedBody}${html.slice(absEnd)}`;
  const issues = detectHtmlQualityIssues(out, { slug });
  return { html: out, changed: changed || out !== html, removed, issues };
}

export function assertPublishQuality(html, { slug } = {}) {
  const issues = detectHtmlQualityIssues(html, { slug });
  if (issues.length) {
    const detail = issues.map((i) => i.code + (i.count ? `(${i.count})` : '')).join(', ');
    throw new Error(`Article quality gate failed for ${slug}: ${detail}`);
  }
}
