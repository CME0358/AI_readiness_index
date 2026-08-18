/**
 * Minimal presentation contract shared by generated and scheduled Insight pages.
 * This intentionally validates the established article template instead of
 * introducing a second rendering system.
 */
export const CANONICAL_PRESENTATION_MARKERS = Object.freeze([
  { code: 'header', marker: '<header class="nav">' },
  { code: 'navigation', marker: 'class="nav-links"' },
  { code: 'article_header', marker: 'class="article-header container"' },
  { code: 'article_width', marker: 'class="article-container"' },
  { code: 'article_body', marker: 'class="article-body container"' },
  { code: 'h1_typography', marker: 'font-size:clamp(1.75rem,4vw,2.25rem)' },
  { code: 'cta', marker: 'class="article-cta"' },
  { code: 'back_link', marker: 'class="back-link"' },
  { code: 'footer', marker: '<footer class="research-footer">' },
  { code: 'responsive_navigation', marker: '@media (max-width:1100px)' },
]);

function compactCss(html) {
  return html
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, '')
    .replace(/;}/g, '}');
}

export function validateCanonicalInsightPresentation(html) {
  const compact = compactCss(html);
  return CANONICAL_PRESENTATION_MARKERS
    .filter(({ marker }) => !html.includes(marker) && !compact.includes(marker.replace(/\s+/g, '')))
    .map(({ code }) => code);
}

export function assertCanonicalInsightPresentation(html, { slug = 'article' } = {}) {
  const missing = validateCanonicalInsightPresentation(html);
  if (missing.length) {
    throw new Error(`${slug}: non-canonical Insight presentation (${missing.join(', ')})`);
  }
}
