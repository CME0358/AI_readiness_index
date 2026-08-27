import { CTA_TYPES } from './cta.mjs';

const FREE_WHITEPAPER = Object.freeze({
  type: CTA_TYPES.LEARN,
  label: '無料ガイドを見る',
  destination: '/whitepaper/2026/free/',
});

const REPORT = Object.freeze({
  type: CTA_TYPES.REPORT,
  label: '自社のAgent Readinessを詳しく調べる',
  destination: '/report/',
});

const PARTNER = Object.freeze({
  type: CTA_TYPES.PARTNER,
  label: 'ARIの活用・連携について相談する',
  destination: '/methodology.html#partners',
});

const INSIGHT_CTA_PROFILES = Object.freeze({
  'act': [REPORT, FREE_WHITEPAPER],
  'book': [REPORT, FREE_WHITEPAPER],
  'pay': [REPORT, FREE_WHITEPAPER],
  'purchase-path-design': [REPORT, FREE_WHITEPAPER],
  'citation-vs-action': [REPORT, FREE_WHITEPAPER],
  'exec': [PARTNER, REPORT],
  'recommendation-logic': [PARTNER, REPORT],
  'competitor-blind-spot': [PARTNER, REPORT],
  'hiring-readiness': [PARTNER, REPORT],
  'three-pillars-ops': [PARTNER, REPORT],
  'ai-search-shift': [FREE_WHITEPAPER, REPORT],
  'ari-vs-geo-seo': [FREE_WHITEPAPER, REPORT],
  'cloudflare-aeo': [FREE_WHITEPAPER, REPORT],
  'llms-txt': [FREE_WHITEPAPER, REPORT],
  'schema': [FREE_WHITEPAPER, REPORT],
  'org-schema-basics': [FREE_WHITEPAPER, REPORT],
  'entity-consistency': [FREE_WHITEPAPER, REPORT],
  'policy-clarity': [FREE_WHITEPAPER, REPORT],
  'availability-signals': [FREE_WHITEPAPER, REPORT],
});

function getInsightCtaProfile(slug) {
  return INSIGHT_CTA_PROFILES[slug] || [FREE_WHITEPAPER, { ...REPORT, label: 'Company Reportを見る' }];
}

function ctaId(slug, cta, index) {
  return `insight_${slug}_${cta.type.toLowerCase()}_${index + 1}`;
}

function renderCtaLink(cta, slug, placement, index) {
  const id = ctaId(slug, cta, index);
  const secondary = index > 0 ? ' btn-secondary' : ' btn-navy';
  return `<a href="${cta.destination}" class="btn${secondary}" data-funnel-cta data-cta-id="${id}" data-cta-type="${cta.type}" data-placement="${placement}" data-source-page="/insights/${slug}/">${cta.label}</a>`;
}

function renderInsightCtaHtml(slug, placement = 'end') {
  const [primary, secondary] = getInsightCtaProfile(slug);
  return `      <div class="sitewide-cta" data-cta-profile="${slug}">\n        <h2>次のリソース</h2>\n        <p>Research Hubの知見を、自社の理解・比較・推薦・行動準備へつなげます。</p>\n        ${renderCtaLink(primary, slug, placement, 0)}\n        ${renderCtaLink(secondary, slug, placement, 1)}\n      </div>\n`;
}

function injectInsightCta(html, slug) {
  const marker = /(<div class="article-cta">)/;
  let result = html;
  if (!result.includes('data-cta-profile="' + slug + '"')) {
    if (!marker.test(result)) return result;
    result = result.replace(marker, `${renderInsightCtaHtml(slug)}$1`);
  }
  if (!result.includes('/assets/sitewide-cta.css')) result = result.replace('</head>', '  <link rel="stylesheet" href="/assets/sitewide-cta.css">\n</head>');
  if (!result.includes('sitewide-cta-tracking.js')) result = result.replace('</body>', '  <script src="/assets/sitewide-cta-tracking.js" defer></script>\n</body>');
  return result;
}

export { INSIGHT_CTA_PROFILES, getInsightCtaProfile, renderInsightCtaHtml, injectInsightCta };
