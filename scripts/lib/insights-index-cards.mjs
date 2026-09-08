/**
 * HTML fragments for Insights index published + planned cards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './insights-v2-paths.mjs';
import { resolvePublicCardSummary } from './insights-card-summary.mjs';

export function dateParts(iso) {
  const d = new Date(iso);
  const y = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric' });
  const m = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', month: '2-digit' });
  const day = d.toLocaleString('en-CA', { timeZone: 'Asia/Tokyo', day: '2-digit' });
  return { ymd: `${y}-${m}-${day}`, dot: `${y}.${m}.${day}` };
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function indexCardThumbnail(slug) {
  const heroPath = `/assets/insights/${slug}/hero.webp`;
  const heroFile = path.join(ROOT, 'assets/insights', slug, 'hero.webp');
  if (!fs.existsSync(heroFile)) return '';
  return `        <div class="insight-card-thumb">
          <img src="${heroPath}" alt="" loading="lazy" width="1672" height="941">
        </div>
`;
}

export function buildPublishedCardHtml(article) {
  const summary = resolvePublicCardSummary(article);
  const { ymd, dot } = dateParts(article.publishAt || article.publishedAt);
  const thumb = indexCardThumbnail(article.slug);
  const tag = article.editorialType === 'current_event' || article.series === 'current-event'
    ? 'Current Event'
    : (article.series === 'flagship' ? 'Flagship Insight' : 'Column');
  return `      <a class="insight-card" href="/insights/${article.slug}/" data-insight-slug="${article.slug}">
${thumb}        <div class="insight-meta">
          <time datetime="${ymd}">${dot}</time>
          <span class="insight-tag">${escapeHtml(tag)}</span>
        </div>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(summary)}</p>
        <span class="read-more">続きを読む →</span>
      </a>
`;
}

export function buildPlannedCardHtml(article) {
  const summary = resolvePublicCardSummary(article);
  const ymd = article.publishAt.slice(0, 10);
  const dot = ymd.replace(/-/g, '.');
  const thumb = indexCardThumbnail(article.slug);
  const tag =
    article.series === 'current-event' || article.editorialType === 'current_event'
      ? 'Current Event'
      : '公開予定';
  return `      <article class="insight-card planned" data-scheduled-slug="${article.slug}">
${thumb}        <div class="insight-meta">
          <time datetime="${ymd}">${dot} 10:00</time>
          <span class="insight-tag soon">${tag}</span>
        </div>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(summary)}</p>
      </article>
`;
}
