import { SITE_ORIGIN } from './constants.mjs';
import { utf16Length } from '../../x-traffic-sidecar/core.mjs';

/**
 * Six reviewable post drafts from publishable facts only.
 * Not scheduled, not sent, not published.
 */
export const POST_DRAFTS = Object.freeze([
  {
    id: 'draft-01',
    bucket: 'pre_purchase_questions',
    media: 'x',
    audience: 'enterprise',
    title: '購入前 — AI検索で見つかるには何から？',
    body: `B2Bの集客入口は検索からAIへ移っています。\n\n「ChatGPTで自社が出るか」だけでなく、比較材料・行動導線まで揃っているかを先に確認する。\n\n無料でURL確認 → 診断レポート（¥29,800税別）\n\n{short_url}\n#AgentReadiness`,
    shortId: 'ref2609e2',
    landingRouteId: 'enterprise_check',
    image: null,
    linkRequired: true,
  },
  {
    id: 'draft-02',
    bucket: 'case_studies',
    media: 'linkedin',
    audience: 'store',
    title: '事例 — 飲食店のAI検索露出（観測層）',
    body: `恵比寿のバー「Bar SECRET」では、GEO Search Protocol 導入後にAI検索での露出・上位表示が確認されています（社内実績記録）。\n\n※来店数・売上の増加率は公開していません。観測・申告・ログは分けて記載しています。\n\n店舗向け継続改善: Local GEO 月額¥60,000（税別）\n事例詳細: https://readiness.coaretail.com/cases/bar-secret/\n無料相談: https://www.coaretail.com/readiness/mtgschedule`,
    shortId: 'ref2609c1',
    landingRouteId: 'store_case',
    image: '/assets/insights/readiness-baseline/hero.webp',
    linkRequired: true,
  },
  {
    id: 'draft-03',
    bucket: 'original_research',
    media: 'linkedin',
    audience: 'enterprise',
    title: '独自調査 — 評価手法と商用成果の分離',
    body: `Agent Readiness Research Hub では、100問調査など評価「手法」の根拠を公開しています。\n\n個別クライアントの成果（事例）とは別ページで、観測・申告・ログを混同しません。\n\nCompany Report（¥29,800税別）には Benchmark Evidence 同梱。\nhttps://readiness.coaretail.com/research/\nhttps://readiness.coaretail.com/report/`,
    shortId: 'ref2609e1',
    landingRouteId: 'enterprise_report',
    image: null,
    linkRequired: true,
  },
  {
    id: 'draft-04',
    bucket: 'news',
    media: 'x',
    audience: 'partner',
    title: 'ニュース — 内製か外注かの判断軸',
    body: `AI検索対策を「SEOの延長」で見ると、比較・推薦・行動までの設計が抜けます。\n\n代理店・SaaS向けに、内製/外注/診断の判断フローをガイドに整理しました。\n\n{short_url}\n#AgentReadiness #AI`,
    shortId: 'ref2609p2',
    landingRouteId: 'partner_guides',
    image: null,
    linkRequired: true,
  },
  {
    id: 'draft-05',
    bucket: 'case_studies',
    media: 'seminar_pitch',
    audience: 'partner',
    title: '共同セミナー案 — AI検索で比較される企業の情報設計',
    body: `【セミナー案・未開催】\n\nテーマ: B2B/店舗がAI検索・推薦で「候補に入り、根拠を持って選ばれ、行動される」ための情報設計\n\n共催: （パートナー名 TBD）\n\n内容案:\n1. SEOとGEO/Readinessの違い（15分）\n2. 公開事例の読み方 — 観測と申告の分離（15分）\n3. 診断レポートの活用と無料相談（10分）\n\n料金言及: Company Report ¥29,800（税別）、Local GEO 月額¥60,000（税別）\n相談: https://www.coaretail.com/readiness/mtgschedule\n\n※リリース転載は独立取材実績として扱いません。`,
    shortId: null,
    landingRouteId: 'partner_consult',
    image: null,
    linkRequired: false,
  },
  {
    id: 'draft-06',
    bucket: 'pre_purchase_questions',
    media: 'email_intro',
    audience: 'enterprise',
    title: '取材・紹介依頼 — 事業概要（メール下書き・未送信）',
    body: `件名: 【ご紹介依頼】AI検索・推薦対策 Agent Readiness（合同会社コア・リテール）\n\n{宛名} 様\n\nお世話になっております。合同会社コア・リテールの佐々木です。\n\n御社メディア/イベントのご紹介枠に、AI検索で企業が比較・推薦されるための情報設計（Agent Readiness）について、5〜10分のご紹介または取材をご検討いただけないでしょうか。\n\n■ 対象: 公式サイトを持つ企業・店舗・代理店\n■ 料金: 診断レポート ¥29,800（税別）/ 店舗向け Local GEO 月額¥60,000（税別）\n■ 根拠: Research Hub の調査手法 + 公開事例（Bar SECRET — 観測層のみ）\n■ 相談: https://www.coaretail.com/readiness/mtgschedule\n\n掲載・取材の可否と許諾範囲をご確認のうえ、ご返信いただけますと幸いです。\n\n合同会社コア・リテール\n代表社員 佐々木 健之\ninfo@coas.asia`,
    shortId: null,
    landingRouteId: 'partner_consult',
    image: null,
    linkRequired: false,
  },
]);

export function resolveDraftBody(draft, shortUrl) {
  return draft.body.replace(/\{short_url\}/g, shortUrl || `${SITE_ORIGIN}/go/${draft.shortId || 'pending'}`);
}

export function validateDraftForMedia(draft, { shortUrl, utf16Len = utf16Length } = {}) {
  const body = resolveDraftBody(draft, shortUrl);
  const errors = [];
  if (draft.media === 'x') {
    const len = utf16Len(body);
    if (len > 279) errors.push(`X length ${len} > 279`);
    if (draft.linkRequired && shortUrl && !body.includes(shortUrl)) {
      errors.push('X draft missing short_url in body');
    }
  }
  if (draft.media === 'linkedin' && body.length > 3000) {
    errors.push(`LinkedIn length ${body.length} > 3000`);
  }
  return { ok: errors.length === 0, body, errors };
}
