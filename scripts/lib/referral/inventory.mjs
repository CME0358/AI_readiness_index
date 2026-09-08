import {
  CASE_STUDIES,
  OFFERINGS,
  ORGANIZATION,
  SAMPLE_REPORT,
  UNRESOLVED_COMMERCIAL,
} from '../service-offerings.mjs';

/**
 * P3-01 asset inventory — publishable facts only.
 * Press release republication ≠ independent interview coverage.
 */
export const ASSET_INVENTORY = Object.freeze({
  organization: Object.freeze({
    legalName: ORGANIZATION.legalName,
    brandName: ORGANIZATION.brandName,
    programName: ORGANIZATION.programName,
    hubName: ORGANIZATION.hubName,
    website: ORGANIZATION.url,
    consultUrl: ORGANIZATION.consultUrl,
    representative: {
      name: '佐々木 健之',
      title: '代表社員',
      publicEmail: 'info@coas.asia',
      source: 'whitepaper/2026/free/index.html',
      permissionNote: '公開資料に記載済み。追加の個人情報は掲載しない',
    },
    profiles: Object.freeze([
      {
        id: 'whitepaper_contact',
        location: 'whitepaper/2026/free/index.html',
        content: '会社名・代表名・info@coas.asia・readiness.coaretail.com',
        permission: '公開LP内の連絡先として掲載済み',
      },
      {
        id: 'services_hub',
        location: '/services/',
        content: '商用オファリング一覧・未確認条件リスト',
        permission: '自社サイト公開',
      },
    ]),
  }),
  offerings: OFFERINGS,
  caseStudies: CASE_STUDIES.map((c) => ({
    slug: c.slug,
    path: c.path,
    displayName: c.displayName,
    industry: c.industry,
    permissionNote: c.permissionNote,
    publishableLayers: c.evidenceLayers.filter((l) => l.status === 'documented'),
    notPublishable: c.evidenceLayers.filter((l) => l.status !== 'documented').map((l) => l.layer),
    limitations: c.limitations,
  })),
  sampleReport: SAMPLE_REPORT,
  unresolved: UNRESOLVED_COMMERCIAL,
  prAndEvents: Object.freeze([
    {
      id: 'press_release_republication',
      type: 'release_republication',
      status: 'not_independent_coverage',
      note: 'リリース転載は独立した取材実績として扱わない（P3-01要件）',
    },
    {
      id: 'joint_seminar',
      type: 'event',
      status: 'draft_only',
      note: '共同セミナー案は referral/review/ に下書きのみ。未開催・未掲載',
    },
    {
      id: 'media_interview',
      type: 'interview',
      status: 'draft_only',
      note: '取材依頼文は下書きのみ。実施・掲載済みとは報告しない',
    },
  ]),
  externalIntroAllowed: Object.freeze([
    'Bar SECRET 店名・公式URL（公開事例ページで許諾済み）',
    'GEO対策後のAI検索露出・上位表示（社内実績記録・観測層）',
    'Company Report ¥29,800（税別）・Local GEO 月額¥60,000（税別）',
    '無料相談 URL: www.coaretail.com/readiness/mtgschedule',
  ]),
  externalIntroForbidden: Object.freeze([
    'Bar SECRET の来店数・売上増加率（公開用検証データなし）',
    'ABIS 非公開資料・特許・未公開仕様',
    'リリース転載を「取材実績」と表現',
    '広告費の扱い（未確認）',
  ]),
});

export function getInventorySummary() {
  return {
    caseStudyCount: ASSET_INVENTORY.caseStudies.length,
    offeringCount: ASSET_INVENTORY.offerings.length,
    unresolvedCount: ASSET_INVENTORY.unresolved.length,
  };
}
