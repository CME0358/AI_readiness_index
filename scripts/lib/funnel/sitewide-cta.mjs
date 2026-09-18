import { CTA_TYPES } from './cta.mjs';
import { ctaIntentProfile, classifyEditorialIntent, isLocalIntent } from '../editorial-intent.mjs';

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

function getInsightCtaProfile(slug, article = null) {
  if (article) {
    const intent = classifyEditorialIntent({ ...article, slug });
    return ctaIntentProfile(intent, {
      local: article.localIntent ?? isLocalIntent({ ...article, slug }),
    });
  }
  return INSIGHT_CTA_PROFILES[slug] || [FREE_WHITEPAPER, { ...REPORT, label: 'Company Reportを見る' }];
}

function ctaId(slug, cta, index) {
  return `insight_${slug}_${cta.type.toLowerCase()}_${index + 1}`;
}

function renderCtaLink(cta, slug, placement, index, editorialIntent = '') {
  const id = ctaId(slug, cta, index);
  const secondary = index > 0 ? ' btn-secondary' : ' btn-navy';
  const intentAttr = editorialIntent ? ` data-editorial-intent="${editorialIntent}"` : '';
  return `<a href="${cta.destination}" class="btn${secondary}" data-funnel-cta data-cta-id="${id}" data-cta-type="${cta.type}" data-placement="${placement}" data-source-page="/insights/${slug}/"${intentAttr}>${cta.label}</a>`;
}

function renderInsightCtaHtml(slug, placement = 'end', article = null) {
  const [primary, secondary] = getInsightCtaProfile(slug, article);
  const editorialIntent = article ? classifyEditorialIntent({ ...article, slug }) : '';
  const links = [primary, secondary].map((cta, index) => renderCtaLink(cta, slug, placement, index, editorialIntent)).join('\n');
  const intentAttr = editorialIntent ? ` data-editorial-intent="${editorialIntent}"` : '';
  return [
    `      <div class="sitewide-cta" data-cta-profile="${slug}"${intentAttr}>`,
    '        <h2>次のリソース</h2>',
    '        <p>Research Hubの知見を、自社の理解・比較・推薦・行動準備へつなげます。</p>',
    links,
    '      </div>',
    '',
  ].join('\n');
}

const SITEWIDE_CTA_STYLESHEET = '<link rel="stylesheet" href="/assets/sitewide-cta.css">';
const ARTICLE_BODY_NAVY_OVERRIDE = `.article-body a.btn-navy,
.article-body a.btn-navy:hover { color: #FFFFFF; }`;

function ensureInsightNavyCtaContrast(html) {
  if (html.includes('.article-body a.btn-navy')) return html;
  if (html.includes('.article-cta .btn-navy,\n.article-cta .btn-navy:hover { color: #FFFFFF; }')) {
    return html.replace(
      '.article-cta .btn-navy,\n.article-cta .btn-navy:hover { color: #FFFFFF; }',
      `.article-cta .btn-navy,\n.article-cta .btn-navy:hover { color: #FFFFFF; }\n${ARTICLE_BODY_NAVY_OVERRIDE}`,
    );
  }
  if (html.includes('.article-cta .btn-navy { color:#FFFFFF; }')) {
    return html.replace(
      '.article-cta .btn-navy { color:#FFFFFF; }',
      `.article-cta .btn-navy { color:#FFFFFF; }\n${ARTICLE_BODY_NAVY_OVERRIDE}`,
    );
  }
  if (html.includes('.article-body a { color: var(--text); }')) {
    return html.replace(
      '.article-body a { color: var(--text); }',
      `.article-body a { color: var(--text); }\n${ARTICLE_BODY_NAVY_OVERRIDE}`,
    );
  }
  if (html.includes('.article-body a { color:var(--text); }')) {
    return html.replace(
      '.article-body a { color:var(--text); }',
      `.article-body a { color:var(--text); }\n${ARTICLE_BODY_NAVY_OVERRIDE}`,
    );
  }
  return html;
}

function ensureSitewideCtaStylesheet(html) {
  if (!html.includes('</head>')) return html;
  const withoutLink = html.replace(/\n?[ \t]*<link rel="stylesheet" href="\/assets\/sitewide-cta\.css">/g, '');
  return withoutLink.replace('</head>', `  ${SITEWIDE_CTA_STYLESHEET}\n</head>`);
}

function injectInsightCta(html, slug, article = null, options = {}) {
  const injectBlock = options.injectBlock !== false;
  const marker = /(<div class="article-cta">)/;
  let result = html;
  if (injectBlock && !result.includes('data-cta-profile="' + slug + '"')) {
    if (marker.test(result)) {
      result = result.replace(marker, `${renderInsightCtaHtml(slug, 'end', article)}$1`);
    }
  }
  result = ensureInsightNavyCtaContrast(result);
  result = ensureSitewideCtaStylesheet(result);
  const hasCta = result.includes('class="sitewide-cta"') || result.includes('data-cta-profile=');
  if (hasCta && !result.includes('sitewide-cta-tracking.js') && result.includes('</body>')) {
    result = result.replace('</body>', '  <script src="/assets/sitewide-cta-tracking.js" defer></script>\n</body>');
  }
  return result;
}

export {
  INSIGHT_CTA_PROFILES,
  getInsightCtaProfile,
  renderInsightCtaHtml,
  injectInsightCta,
  ensureInsightNavyCtaContrast,
  ensureSitewideCtaStylesheet,
};
