/**
 * Insights/SNS editorial mix — consult contribution focus.
 * Config only. Does NOT modify Buffer queue or scheduled posts.
 */
export const EDITORIAL_MIX_P3 = Object.freeze({
  version: 'p3-01',
  goal: 'consult_contribution',
  effectiveFrom: '2026-09-08',
  bufferPolicy: 'DO_NOT_MODIFY_SCHEDULED',
  sidecarPolicy: 'DO_NOT_MODIFY_X_SIDECAR_LEDGER',
  buckets: Object.freeze({
    pre_purchase_questions: Object.freeze({
      pct: 40,
      label: '購入前疑問',
      examples: ['診断の違い', '内製/外注', 'ChatGPTで見えるか', '料金の目安'],
      primaryCta: 'CHECK',
      landingRoutes: ['enterprise_check', 'enterprise_report'],
    }),
    case_studies: Object.freeze({
      pct: 30,
      label: '事例',
      examples: ['Bar SECRET 観測層', '業種別の読み方', '申告とログの分離'],
      primaryCta: 'CONSULT',
      landingRoutes: ['store_case', 'store_localgeo'],
    }),
    original_research: Object.freeze({
      pct: 20,
      label: '独自調査',
      examples: ['ARI Research', '100問調査', 'Research Hub'],
      primaryCta: 'REPORT',
      landingRoutes: ['enterprise_report'],
    }),
    news: Object.freeze({
      pct: 10,
      label: 'ニュース',
      examples: ['AI検索の構造変化', '公開Insightsの新着'],
      primaryCta: 'INSIGHT',
      landingRoutes: ['partner_guides'],
    }),
  }),
});

export function mixTotalPct() {
  return Object.values(EDITORIAL_MIX_P3.buckets).reduce((sum, b) => sum + b.pct, 0);
}

export function weeklySlotAllocation(totalPosts = 10) {
  const out = {};
  let assigned = 0;
  const entries = Object.entries(EDITORIAL_MIX_P3.buckets);
  for (let i = 0; i < entries.length; i += 1) {
    const [key, bucket] = entries[i];
    const count = i === entries.length - 1
      ? totalPosts - assigned
      : Math.round(totalPosts * bucket.pct / 100);
    out[key] = { ...bucket, slots: count };
    assigned += count;
  }
  return out;
}
