/**
 * ARI-P1-02 — Canonical commercial facts for readiness.coaretail.com public pages.
 * Prices and scope must match product-catalog.mjs / improve.html / report copy.
 */

export const ORGANIZATION = Object.freeze({
  legalName: '合同会社コア・リテール',
  brandName: 'Coa Retail',
  programName: 'Agent Readiness Index',
  hubName: 'Agent Readiness Research Hub',
  url: 'https://www.coaretail.com',
  consultUrl: 'https://www.coaretail.com/readiness/mtgschedule',
});

export const OFFERINGS = Object.freeze([
  {
    id: 'company_report',
    name: 'Agent Readiness Company Report',
    shortLabel: 'Company Report（診断レポート）',
    path: '/report/',
    canonical: 'https://readiness.coaretail.com/report/',
    priceExTaxYen: 29_800,
    taxLabel: '税別',
    priceTaxInclYen: 32_780,
    contract: 'スポット購入（1社1回）',
    deliveryLeadTime: '入力後約3分でレポート生成',
    target: '公式サイトURLを持つ企業・サービス事業者',
    problem: 'AI検索・推薦の候補に入らない、比較材料が不足している',
    scope: [
      '23項目の Agent Readiness 診断',
      '4大AI（ChatGPT / Gemini / Claude / Perplexity）の認識分析',
      '改善優先順位とロードマップ',
      'Personalized Decision Report（PDF）',
      'ARI Research Report 2026（Benchmark Evidence）同梱',
    ],
    outOfScope: [
      '実装代行（別プランまたは Local GEO）',
      '特定の検索順位・売上・来店数の成果保証',
      '広告運用・媒体費の包含',
    ],
    customerWork: ['会社名・公式サイトURL・業種・メールの入力', 'Stripeでの決済'],
    afterPurchase: [
      '決済完了後、同一ブラウザで診断フォームへ進む',
      '約3分でレポート生成・結果表示',
      'PDFダウンロード、Research Edition 同梱資料へのアクセス',
    ],
    additionalFees: '表示価格以外の必須費用なし（税込 ¥32,780 は決済時表示）',
    schemaType: 'Product',
  },
  {
    id: 'local_geo',
    name: 'Local GEO 改善プラン',
    shortLabel: '店舗・地域ビジネス向け月額',
    path: 'https://localgeo.coaretail.com/',
    priceExTaxYen: 60_000,
    taxLabel: '税別',
    priceTaxInclYen: null,
    contract: '月額（詳細は Local GEO サイトで確認）',
    deliveryLeadTime: '契約後の運用設計・改善サイクルに依存',
    target: '店舗・クリニック・地域密着型ビジネス',
    problem: '地域検索・AI推薦での集客改善を継続運用したい',
    scope: ['地域ビジネス向けの改善プラン（Local GEO サービス）'],
    outOfScope: ['Company Report の代替', 'Advisory / Implementation の包含（別契約）'],
    customerWork: ['Local GEO 側の申込・ヒアリング'],
    afterPurchase: ['localgeo.coaretail.com の案内フローに従う'],
    additionalFees: '未確認 — Local GEO 正式資料で確認',
    external: true,
  },
  {
    id: 'advisory',
    name: 'Agent Readiness Advisory',
    shortLabel: '年間改善伴走',
    path: '/improve.html',
    canonical: 'https://readiness.coaretail.com/improve.html',
    priceExTaxYen: 198_000,
    taxLabel: '税別',
    priceTaxInclYen: null,
    contract: '12ヶ月契約',
    deliveryLeadTime: '契約開始後の定例レビューから',
    target: 'Company Report 後に継続改善を進める企業',
    problem: '優先順位の更新と再評価を社内だけで回しきれない',
    scope: ['定期レビュー', '改善優先順位の更新', 'AI認識/推薦状況の継続確認', '四半期ロードマップ更新'],
    outOfScope: ['実装作業そのもの（Design / Implementation プラン）', '成果保証'],
    customerWork: ['社内担当者の定例参加', '改善施策の社内実行'],
    afterPurchase: ['無料相談予約 → 個別見積 → 契約'],
    additionalFees: '個別見積（Implementation Design ¥250,000〜¥300,000程度 / Managed Implementation ¥300,000〜 税別）',
  },
]);

/** Items that must NOT appear as public promises until confirmed. */
export const UNRESOLVED_COMMERCIAL = Object.freeze([
  { id: 'local_geo_ads', topic: 'Local GEO の広告費・媒体費の扱い', status: '未確認（localgeo 正式資料待ち）' },
  { id: 'local_geo_term', topic: 'Local GEO の最低契約期間・解約条件', status: '未確認（別サイト）' },
  { id: 'advisory_sla', topic: 'Advisory の定例回数・SLA', status: '個別契約で確定' },
  { id: 'bar_secret_visit', topic: 'Bar SECRET の来店数・売上インパクト', status: '公開用検証データなし' },
  { id: 'bar_secret_queries', topic: 'Bar SECRET の観測クエリ一覧・定点観測ログ', status: '公開版未整備' },
]);

export const CASE_STUDIES = Object.freeze([
  {
    slug: 'bar-secret',
    path: '/cases/bar-secret/',
    canonical: 'https://readiness.coaretail.com/cases/bar-secret/',
    displayName: 'Bar SECRET',
    industry: '飲食（バー）',
    area: '東京都・恵比寿',
    website: 'https://www.barsecret.tokyo',
    serviceLine: 'GEO Search Protocol（AI検索最適化）',
    permissionNote: '公開事例として店名・公式サイトを掲載（CLAUDE.md / 営業資料で使用）',
    evidenceLayers: Object.freeze([
      {
        layer: 'AI推薦表示（観測）',
        status: 'documented',
        summary: 'GEO対策後、AI検索における露出・上位表示が確認された（社内記録・CLAUDE.md）',
        limitation: '公開ページでは特定クエリ・スクリーンショット・定点日付は未掲載',
      },
      {
        layer: '顧客申告',
        status: 'not_published',
        summary: '営業資料に来店の言及があるが、公開事例ページでは未掲載',
        limitation: '申告と観測を混同しない',
      },
      {
        layer: 'アクセス・来店ログ',
        status: 'not_connected',
        summary: 'Web/来店の第三者検証データは本ページに接続していない',
        limitation: '因果や増加率は断定しない',
      },
    ]),
    interventions: [
      '公式情報の構造化・比較材料の整理（GEO Search Protocol の情報設計）',
      'AIが参照できる公開面の整備',
    ],
    periodNote: '改善期間・観測条件の詳細は公開版未整備（未確認リスト参照）',
    publicOutcome: 'GEO対策後にAI検索で上位表示を達成（出典：社内実績記録）',
    limitations: [
      '他施策・季節要因との因果分離はしていない',
      '来店数・売上の増加率は公開していない',
      '継続観測の全ログは非公開',
    ],
  },
]);

export const SAMPLE_REPORT = Object.freeze({
  path: '/sample/',
  demoUrl: '/report/?report=demo',
  label: '構成見本（架空データ）',
  disclaimer: '表示データは illustrative / demo 用です。実際の購入レポート・実測スコアではありません。',
});

export const PAGE_PATHS = Object.freeze({
  services: '/services/',
  cases: '/cases/',
  sample: '/sample/',
});
