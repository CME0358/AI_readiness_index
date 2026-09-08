/**
 * ARI-P2-01 — Purchase-intent query inventory and page routing.
 * Search volumes are NOT asserted; unverified queries are labeled hypothesis.
 */
import { OFFERINGS, ORGANIZATION, CASE_STUDIES } from './service-offerings.mjs';

/** @typedef {'hypothesis'|'mapped'|'evidence_backed'} QueryStatus */

/**
 * @type {Array<{ id: string, queryJa: string, status: QueryStatus, primaryPath: string, insightSlugs: string[], notes?: string }>}
 */
export const QUERY_INVENTORY = Object.freeze([
  {
    id: 'vendor_pricing',
    queryJa: 'AI検索対策 依頼先 料金 範囲',
    status: 'mapped',
    primaryPath: '/guides/ai-search-services/',
    insightSlugs: ['ari-vs-geo-seo', 'readiness-baseline', 'vendor-selection'],
    notes: 'Commercial facts on /services/; comparison on ari-vs-geo-seo',
  },
  {
    id: 'chatgpt_not_showing',
    queryJa: 'ChatGPTに出ない 原因',
    status: 'evidence_backed',
    primaryPath: '/guides/chatgpt-visibility-check/',
    insightSlugs: ['blind', 'vis', 'checklist', 'entity-consistency'],
    notes: 'Editorial on blind; free URL check on homepage #company-check',
  },
  {
    id: 'competitor_compare',
    queryJa: '競合比較 AI検索 見えない',
    status: 'evidence_backed',
    primaryPath: '/guides/inhouse-vs-outsource/',
    insightSlugs: ['competitor-blind-spot', 'recommendation-logic', 'citation-vs-action'],
    notes: 'Research 100問調査 cited on blind/research — not invented uplift',
  },
  {
    id: 'inhouse_outsource',
    queryJa: 'AI検索対策 内製 外注',
    status: 'hypothesis',
    primaryPath: '/guides/inhouse-vs-outsource/',
    insightSlugs: ['competitor-blind-spot', 'three-pillars-ops', 'execution-readiness'],
  },
  {
    id: 'industry_examples',
    queryJa: 'AI検索対策 事例 業種',
    status: 'mapped',
    primaryPath: '/cases/',
    insightSlugs: ['competitor-blind-spot'],
    notes: 'Bar SECRET published with observation/claim separation',
  },
  {
    id: 'geo_vs_seo',
    queryJa: 'SEO GEO 違い AI検索',
    status: 'evidence_backed',
    primaryPath: '/insights/ari-vs-geo-seo/',
    insightSlugs: ['ari-vs-geo-seo', 'ai-search-shift', 'citation-vs-action'],
  },
]);

/**
 * Priority themes implemented in P2-01 (playbook pages).
 * @type {Array<{ id: string, path: string, title: string, rationale: string[] }>}
 */
export const PRIORITY_THEMES = Object.freeze([
  {
    id: 'ai-search-services',
    path: '/guides/ai-search-services/',
    title: 'AI検索対策の依頼先・料金・範囲',
    rationale: [
      '商流への近さ（/services/・/report/ 直結）',
      '既存料金根拠（service-offerings.mjs）',
      'ari-vs-geo-seo との役割分担で重複回避',
    ],
  },
  {
    id: 'chatgpt-visibility-check',
    path: '/guides/chatgpt-visibility-check/',
    title: 'ChatGPTに出ないときの確認手順',
    rationale: [
      'blind / vis の既存需要と整合',
      '無料 #company-check で離脱前に行動可能',
      'Research 100問・5業種231件の根拠を引用可能',
    ],
  },
  {
    id: 'inhouse-vs-outsource',
    path: '/guides/inhouse-vs-outsource/',
    title: '内製か外注か — 競合比較の観測から決める',
    rationale: [
      'competitor-blind-spot の購入直前ニーズ',
      '事例・相談CTAへの接続',
      '成果保証なしの契約境界を維持',
    ],
  },
]);

/** Backlog — not implemented in P2-01 */
export const THEME_BACKLOG = Object.freeze([
  { id: 'vendor-selection-deep', path: '/insights/vendor-selection/', note: 'editorial_hold — publish gate後に playbook 接続' },
  { id: 'dental-vertical', path: '/dental.html', note: '歯科ベンチマーク — 購入意図は Report/相談へ分岐' },
  { id: 'local-store-intent', path: 'https://localgeo.coaretail.com/', note: '店舗意図は Local GEO へ（別サイト）' },
]);

export const COMMERCIAL_CTA_ROUTES = Object.freeze({
  companyUrl: {
    ctaType: 'REPORT',
    href: '/report/',
    label: 'Company Report（¥29,800・税別）',
    offeringId: 'company_report',
  },
  storeLocal: {
    ctaType: 'LOCAL',
    href: 'https://localgeo.coaretail.com/?utm_source=ari_guides&utm_medium=outbound&utm_campaign=direct_buyer',
    label: 'Local GEO（月額¥60,000・税別）',
    offeringId: 'local_geo',
  },
  consult: {
    ctaType: 'CONSULT',
    href: ORGANIZATION.consultUrl,
    label: '無料相談を予約',
  },
  freeCheck: {
    ctaType: 'CHECK',
    href: '/#company-check',
    label: '公式URLを無料で簡易確認',
  },
  servicesHub: {
    ctaType: 'LEARN',
    href: '/services/',
    label: 'サービス・料金一覧',
  },
});

export function offeringById(id) {
  return OFFERINGS.find((o) => o.id === id);
}

export function queriesForPath(path) {
  return QUERY_INVENTORY.filter((q) => q.primaryPath === path || q.primaryPath.startsWith(path));
}

export function publishedCaseStudy(slug) {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
