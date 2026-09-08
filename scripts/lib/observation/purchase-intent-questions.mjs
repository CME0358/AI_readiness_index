import { SEGMENTS } from './constants.mjs';

/**
 * 12 non-branded purchase-intent questions (4 per segment).
 * 指名認識テストは observation/named-entity/ で別管理。
 */
export const PURCHASE_INTENT_QUESTIONS = Object.freeze([
  {
    id: 'ent-01',
    segment: SEGMENTS.ENTERPRISE,
    text: 'B2B企業がAI検索やAIアシスタントから見つけられるようにするには、何から手を付けるべきですか？',
    intent: 'priority_and_scope',
  },
  {
    id: 'ent-02',
    segment: SEGMENTS.ENTERPRISE,
    text: 'AI検索対策の依頼先を比較する際に確認すべきポイントを教えてください。',
    intent: 'vendor_comparison',
  },
  {
    id: 'ent-03',
    segment: SEGMENTS.ENTERPRISE,
    text: '自社サイトのAI検索対応状況を診断できるサービスはありますか？料金の目安も知りたいです。',
    intent: 'diagnosis_pricing',
  },
  {
    id: 'ent-04',
    segment: SEGMENTS.ENTERPRISE,
    text: 'SEO・GEO・AI検索対応状況の違いと、企業が最初に整備すべき領域を教えてください。',
    intent: 'framework_comparison',
  },
  {
    id: 'store-01',
    segment: SEGMENTS.STORE,
    text: '店舗やクリニックの集客をAI検索で改善したいです。月額いくらくらいのサービスがありますか？',
    intent: 'local_pricing',
  },
  {
    id: 'store-02',
    segment: SEGMENTS.STORE,
    text: '地域ビジネスでAIから予約や問い合わせにつなげるために必要な情報設計を教えてください。',
    intent: 'actionability',
  },
  {
    id: 'store-03',
    segment: SEGMENTS.STORE,
    text: '飲食店や美容サロン向けのAI検索・MEO対策でおすすめの進め方は？',
    intent: 'vertical_playbook',
  },
  {
    id: 'store-04',
    segment: SEGMENTS.STORE,
    text: '店舗の口コミと公式サイトの情報をAIに正しく理解させるには何が必要ですか？',
    intent: 'authority_consistency',
  },
  {
    id: 'partner-01',
    segment: SEGMENTS.PARTNER,
    text: '代理店がクライアント向けにAI検索対策を提供する場合、内製と外注の判断基準は？',
    intent: 'inhouse_outsource',
  },
  {
    id: 'partner-02',
    segment: SEGMENTS.PARTNER,
    text: '複数社にAI検索診断レポートを提供できる仕組みやツールはありますか？',
    intent: 'multi_client_diagnosis',
  },
  {
    id: 'partner-03',
    segment: SEGMENTS.PARTNER,
    text: 'SaaSやマーケティング会社がAI検索対策機能を組み込むべきか、専門会社に任せるべきか教えてください。',
    intent: 'product_integration',
  },
  {
    id: 'partner-04',
    segment: SEGMENTS.PARTNER,
    text: 'AI検索での競合比較状況を定期的に観測する方法と、取れる指標を教えてください。',
    intent: 'competitive_observation',
  },
]);

export function getQuestionById(id) {
  return PURCHASE_INTENT_QUESTIONS.find((q) => q.id === id) || null;
}

export function questionsBySegment(segment) {
  return PURCHASE_INTENT_QUESTIONS.filter((q) => q.segment === segment);
}

export function assertNoBrandInQuestions(brandTerms = []) {
  const violations = [];
  for (const q of PURCHASE_INTENT_QUESTIONS) {
    const lower = q.text.toLowerCase();
    for (const term of brandTerms) {
      if (lower.includes(String(term).toLowerCase())) violations.push({ id: q.id, term });
    }
  }
  return violations;
}
