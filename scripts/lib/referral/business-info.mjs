import { ORGANIZATION, OFFERINGS, CASE_STUDIES } from '../service-offerings.mjs';

const report = OFFERINGS.find((o) => o.id === 'company_report');
const localGeo = OFFERINGS.find((o) => o.id === 'local_geo');

/** External referral one-pager facts — no invented claims. */
export const BUSINESS_INFO_PACK = Object.freeze({
  headline: 'Agent Readiness — AI検索・推薦で見つけられ、比較され、行動される状態を設計する',
  organization: ORGANIZATION,
  targets: Object.freeze({
    enterprise: report.target,
    store: localGeo.target,
    partner: '代理店・SaaS・マーケティング会社（クライアント向けAI検索対策の提供判断）',
  }),
  pricing: Object.freeze({
    companyReport: `¥${report.priceExTaxYen.toLocaleString('ja-JP')}（税別）`,
    localGeoMonthly: `月額¥${localGeo.priceExTaxYen.toLocaleString('ja-JP')}（税別）`,
    advisoryFrom: '¥198,000（税別）/月〜（12ヶ月・個別見積）',
  }),
  scope: Object.freeze({
    companyReport: report.scope,
    localGeo: localGeo.scope,
    outOfScope: [
      ...report.outOfScope,
      '成果保証（順位・売上・来店数）',
      '広告費の包含（未確認条件は掲載しない）',
    ],
  }),
  evidence: Object.freeze({
    research: 'ARI Research Report 2026 / Research Hub（評価手法の根拠）',
    caseStudy: `${CASE_STUDIES[0].displayName} — 観測層のみ公開（来店・売上増は未掲載）`,
    notEvidence: 'プレスリリース転載は独立取材実績ではない',
  }),
  consultUrl: ORGANIZATION.consultUrl,
  primaryUrls: Object.freeze({
    hub: 'https://readiness.coaretail.com/',
    report: report.canonical,
    services: 'https://readiness.coaretail.com/services/',
    cases: 'https://readiness.coaretail.com/cases/',
    guides: 'https://readiness.coaretail.com/guides/',
    localGeo: localGeo.path,
  }),
});

export function businessInfoMarkdown() {
  const b = BUSINESS_INFO_PACK;
  return `# 外部紹介用 事業者情報（P3-01）

> **ステータス:** レビュー用下書き。掲載・送信済みではない。

## 対象
- **企業:** ${b.targets.enterprise}
- **店舗:** ${b.targets.store}
- **協業:** ${b.targets.partner}

## 料金（税別）
- Company Report: ${b.pricing.companyReport}
- Local GEO: ${b.pricing.localGeoMonthly}
- Advisory: ${b.pricing.advisoryFrom}

## 提供範囲（Company Report）
${b.scope.companyReport.map((s) => `- ${s}`).join('\n')}

## 提供外
${b.scope.outOfScope.map((s) => `- ${s}`).join('\n')}

## 根拠・事例の扱い
- 研究: ${b.evidence.research}
- 事例: ${b.evidence.caseStudy}
- 注意: ${b.evidence.notEvidence}

## 相談
${b.consultUrl}
`;
}
