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

export const CANONICAL_HERO_CSS_HREF = '../../assets/insights/hero.css';

function heroCssLinkCount(html, href = CANONICAL_HERO_CSS_HREF) {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (html.match(new RegExp(`<link\\b[^>]*rel=["']stylesheet["'][^>]*href=["']${escaped}["'][^>]*>`, 'gi')) || []).length;
}

/**
 * Optional Hero gate for article publication. Articles without a Hero remain
 * publishable; once a canonical Hero exists, its presentation contract is
 * required and deterministic.
 */
export function validateOptionalHeroPresentation(
  html,
  { heroExists = false, heroCssExists = true, slug = 'article', heroUrl = null } = {},
) {
  if (!heroExists) return { ok: true, status: 'HERO_OPTIONAL', errors: [] };
  const rel = `/assets/insights/${slug}/hero.webp`;
  const absolute = heroUrl || `https://readiness.coaretail.com/assets/insights/${slug}/hero.webp`;
  const errors = [];
  if (!heroCssExists) errors.push('hero_css_missing');
  if (heroCssLinkCount(html) !== 1) errors.push('hero_css_link_count');
  if (!html.includes('class="insight-hero"')) errors.push('hero_markup_missing');
  const heroMarkup = html.match(/<figure\b[^>]*class=["']insight-hero["'][\s\S]*?<\/figure>/i)?.[0] || '';
  if (!heroMarkup.includes(`src="${rel}"`) && !heroMarkup.includes(`src="${absolute}"`)) errors.push('hero_reference_missing');
  if (!html.includes(`og:image" content="${absolute}`)) errors.push('og_image_missing');
  if (!html.includes(`twitter:image" content="${absolute}`)) errors.push('twitter_image_missing');
  return { ok: errors.length === 0, status: errors.length ? 'PRESENTATION_INVALID' : 'PRESENTATION_VALID', errors };
}

export function repairCanonicalHeroCssLink(html, { heroCssExists = true } = {}) {
  if (!heroCssExists) return { html, changed: false, status: 'PRESENTATION_BLOCKED', reason: 'hero_css_missing' };
  if (heroCssLinkCount(html) > 1) return { html, changed: false, status: 'PRESENTATION_BLOCKED', reason: 'duplicate_hero_css_link' };
  if (heroCssLinkCount(html) === 1) return { html, changed: false, status: 'PRESENTATION_VALID' };
  const marker = '<link rel="stylesheet" href="../../assets/hub-animations.css">';
  if (!html.includes(marker)) return { html, changed: false, status: 'PRESENTATION_BLOCKED', reason: 'stylesheet_anchor_missing' };
  return {
    html: html.replace(marker, `${marker}\n<link rel="stylesheet" href="${CANONICAL_HERO_CSS_HREF}">`),
    changed: true,
    status: 'PRESENTATION_REPAIRED',
  };
}
