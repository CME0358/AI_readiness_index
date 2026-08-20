/**
 * Agency Partner Preview — static illustrative fixture.
 * No token, no API, no real company data.
 */

export const PARTNER_SAMPLE_COMPANY = {
  company_name: "株式会社サンプルサービス",
  url: "https://sample-service.example.jp",
  industry: "サービス業（架空サンプル）",
};

/** ARI three pillars — status only, no fabricated rankings or industry averages */
export const PARTNER_SAMPLE_PILLARS = [
  {
    id: "visibility",
    label: "AI Visibility",
    jp: "発見・理解",
    status: "warn",
    summary: "公式情報は検索で見つかる一方、AIが比較に使う属性（提供内容・条件・対象）の読み取りに余地があります。",
  },
  {
    id: "authority",
    label: "Authority",
    jp: "信頼・引用",
    status: "warn",
    summary: "第三者情報との整合や、推薦根拠として参照されやすい情報源の整備が部分的です。",
  },
  {
    id: "actionability",
    label: "Actionability",
    jp: "比較・推薦・実行",
    status: "unknown",
    summary: "問い合わせ・予約導線の存在は確認できる一方、AI経由の行動接続は完全版レポートで評価します。",
  },
];

export const PARTNER_SAMPLE_OBSERVATIONS = [
  {
    code: "OBS_ENTITY_CONSISTENCY",
    copy: "公式サイトと外部プロフィールで、サービス説明の粒度に差が見られます。",
    qualification: "架空サンプル。完全版レポートでは実サイト解析に基づき評価します。",
  },
  {
    code: "OBS_COMPARISON_ATTRIBUTES",
    copy: "料金・対象・提供範囲など、AI比較に使われる属性がページ上で明示しづらい箇所があります。",
    qualification: "架空サンプル。公開ページのHTML解析時点の示唆です。",
  },
  {
    code: "OBS_FAQ_STRUCTURE_WEAK",
    copy: "FAQ / よくある質問の構造化が弱く、AIが回答材料を拾いにくい状態です。",
    qualification: "FAQPage schema の有無は完全版レポートで確認します。",
  },
];

export const PARTNER_SAMPLE_CHECK_SUMMARY = {
  checked_count: 5,
  total_teaser: 23,
  check_items: [
    { id: "entity_consistency", label: "企業情報の一貫性", status: "warn" },
    { id: "comparison_attrs", label: "比較に使われる属性の明示", status: "warn" },
    { id: "faq_structure", label: "FAQ / 構造化情報", status: "warn" },
    { id: "structured_data", label: "構造化データ（Schema.org）", status: "pass" },
    { id: "booking_path", label: "問い合わせ / 予約導線", status: "unknown" },
  ],
};

export const PARTNER_VIDEO = {
  src: "/report/scene-videos/scene-01-ai-search.mp4",
  poster: "",
  title: "AI検索で見つかる",
  description:
    "ユーザーが「このエリアでおすすめのサービスを教えて」とAIに質問したとき、検索では見つかる企業が候補に入らないケースを示す短尺動画です。",
};

export const PARTNER_CTA = {
  primary: {
    label: "ARIレポートを確認する",
    href: "/report/",
  },
  secondary: {
    label: "クライアントへの展開について相談する",
    href: "https://www.coaretail.com/readiness/mtgschedule",
    external: true,
  },
};
