import { EVENT_STATUSES, ARTICLE_TYPES } from './constants.mjs';

function slugify(title, company) {
  const base = `${company}-${title}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
  return base.replace(/-+$/, '') || 'current-event';
}

export function buildSeoPackage(event, interpretation) {
  const company = event.company;
  const topic = event.title.replace(/\s+/g, ' ').slice(0, 60);
  const title = `${company}の発表で企業のAI検索対策は何が変わる？`;
  const meta = `${company}の最新公式発表をAgent Readiness視点で解説。DiscoveryからActionまで、企業が今確認すべき判断ポイントを整理。`;
  return {
    slug_proposal: slugify(event.title, company),
    title,
    meta_description: meta,
    h1: title,
    direct_answer: `${company}の公式発表は、AIが企業を発見・理解・比較・推薦・行動する各段階に影響し得る。BtoB/BtoC問わず、自社がどの段階で止まっているかを先に確認する。`,
    search_intent: 'Business decision — current platform update',
    primary_query: `${company} AI 検索 企業 影響`,
    secondary_queries: ['AI検索対策 優先順位', 'Agent Readiness 意味'],
    og_title: title,
    og_description: meta,
  };
}

export function generateArticleDraft(event, scoring, interpretation, cannibalization, seo) {
  const layers = (interpretation.ari_layer_impact || []).join(' / ') || '要確認';
  const isRefresh = cannibalization.article_type === ARTICLE_TYPES.EXISTING_ARTICLE_REFRESH;
  const moneyAdjacent = (event.score || 0) >= 65;

  const lines = [
    '---',
    `event_id: ${event.event_id}`,
    `company: ${event.company}`,
    `source_url: ${event.url}`,
    `source_date: ${event.published_date || 'UNKNOWN'}`,
    `detected_at: ${event.detected_at}`,
    `score: ${event.score}`,
    `priority: ${event.priority}`,
    `freshness: ${event.freshness ?? 1}`,
    `status: ${EVENT_STATUSES.READY_FOR_EDITORIAL_REVIEW}`,
    `article_type: ${cannibalization.article_type}`,
    `search_intent: ${seo.search_intent}`,
    `canonical_conflict: ${cannibalization.conflict_slug || 'none'}`,
    `created_at: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${seo.h1}`,
    '',
    `> **Direct Answer:** ${seo.direct_answer}`,
    '',
    '## What Happened',
    '',
    interpretation.what_happened,
    '',
    `公式ソース: ${event.url}`,
    '',
    '## Why It Matters',
    '',
    interpretation.why_it_matters,
    '',
    '## ARI Interpretation',
    '',
    `影響レイヤー: ${layers}`,
    '',
    interpretation.business_impact,
    '',
    '## Key Points',
    '',
    '- 検索順位だけでなく、AIによる認識・理解・比較・推薦・行動の各段階を見る',
    '- 公式情報の整合性と更新オーナーを確認する',
    '- 定点観測で自社への影響を記録する',
    '',
    '## Evidence',
    '',
    '- 一次ソース: 公式発表URL（上記）',
    '- ARI Framework: https://readiness.coaretail.com/framework/',
    '- 関連Researchがある場合のみ: https://readiness.coaretail.com/research/',
    '',
    '## What To Do Now',
    '',
    interpretation.what_companies_should_do,
    '',
    '## Limitations / Unknowns',
    '',
    interpretation.risks_unknowns,
    '',
  ];

  if (isRefresh && cannibalization.conflict_slug) {
    lines.push('## Related Insight (Refresh Candidate)', '', `- 既存Insight更新候補: /insights/${cannibalization.conflict_slug}/`, '');
  } else {
    lines.push('## Related Insight / Research', '', '- Framework: https://readiness.coaretail.com/framework/', '- Research Hub: https://readiness.coaretail.com/research/', '');
  }

  if (moneyAdjacent) {
    lines.push(
      '## Company Report Bridge',
      '',
      '一般的な対策ではなく、自社の場合どこから直すべきか確認する。',
      '',
      '**CTA:** 自社の改善優先順位を確認する',
      '',
      '→ https://readiness.coaretail.com/report/',
      '',
      '（公開HTMLでは `data-ga-insight-cta="report"` を維持）',
      '',
    );
  }

  lines.push('---', '', `<!-- RMVU-05D draft · NOT PUBLISHED · event ${event.event_id} -->`, '');

  return lines.join('\n');
}
