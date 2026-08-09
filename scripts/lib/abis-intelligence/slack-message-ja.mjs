import {
  RECOMMENDED_ACTIONS,
  CONFIDENCE_LEVELS,
  PATENT_FLAGS,
  ABIS_SEVERITY,
} from './constants.mjs';

const AFFECTED_AREA_JA = {
  Foundation: '基盤モデル（Foundation）',
  Representation: '表現モデル（Representation）',
  Governance: 'ガバナンス（Governance）',
  Binding: 'Binding / 接続実現',
  'Technology Profiles': 'Technology Profile',
  'Reference Examples': 'Reference Example',
  'Runtime Demonstrator': 'Runtime Demonstrator',
  'Evidence Architecture': 'Evidence / 実行証跡',
  'Business Authorization Architecture': 'Business Authorization / 権限・認可',
};

const ACTION_JA = {
  [RECOMMENDED_ACTIONS.NO_ACTION]: '対応不要',
  [RECOMMENDED_ACTIONS.MONITOR]: '継続監視',
  [RECOMMENDED_ACTIONS.REVIEW]: 'レビュー推奨',
  [RECOMMENDED_ACTIONS.CREATE_RESEARCH_NOTE]: '非公開リサーチノート作成推奨',
  [RECOMMENDED_ACTIONS.OPEN_REPOSITORY_TASK]: 'Repositoryタスク起票推奨',
};

const CONFIDENCE_JA = {
  [CONFIDENCE_LEVELS.HIGH]: '高',
  [CONFIDENCE_LEVELS.MEDIUM]: '中',
  [CONFIDENCE_LEVELS.LOW]: '低',
};

const PATENT_FLAG_JA = {
  [PATENT_FLAGS.POTENTIAL_OVERLAP_REVIEW]: '潜在的な重なりを要レビュー',
  [PATENT_FLAGS.HUMAN_REVIEW_RECOMMENDED]: '人による確認推奨',
};

const FORBIDDEN_PATENT_PHRASES = /特許侵害|侵害|抵触|FTO|特許性|freedom-to-operate|infringement/i;

export function formatAffectedAreaJa(area) {
  return AFFECTED_AREA_JA[area] || area;
}

export function formatRecommendedActionJa(action) {
  const ja = ACTION_JA[action] || action;
  return `${ja}（${action}）`;
}

export function formatConfidenceJa(confidence) {
  const ja = CONFIDENCE_JA[confidence] || confidence;
  return `${ja}（${confidence}）`;
}

export function formatAriStatusJa(status = '') {
  const s = String(status);
  if (/TEST/i.test(s)) return s;
  if (/REFRESH|EXISTING_ARTICLE_REFRESH/i.test(s)) return '既存記事更新候補';
  if (/BLOCKED/i.test(s)) return '記事化対象外（ブロック）';
  if (/IGNORE/i.test(s)) return '記事化対象外';
  if (/READY_FOR_EDITORIAL_REVIEW/i.test(s)) return '記事候補あり（編集レビュー待ち）';
  if (/\bP0\b/.test(s)) return '記事候補あり（P0）';
  if (/\bP1\b/.test(s)) return '記事候補あり（P1）';
  if (/\bP2\b/.test(s)) return '記事候補あり（P2）';
  if (/SCORED|DRAFTED|VALIDATED/i.test(s)) return 'ARI評価中';
  return s || '未評価';
}

function formatSourceDate(iso) {
  if (!iso) return '不明';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return String(iso).slice(0, 10);
  }
}

function buildYokakunin(impact, title) {
  const areas = impact.affected_areas || [];
  const checks = [];

  if (impact.binding_only_change) {
    checks.push(
      'Binding / Technology Profile 側の実装変化を確認。ABIS意味層（semantic core）の無効化ではないか切り分ける。',
    );
  }
  if (areas.includes('Business Authorization Architecture') || (impact.authority_impact || 0) >= 12) {
    checks.push('Business Authorization / 権限・認可モデルと Execution Contract との整合を確認。');
  }
  if (areas.includes('Runtime Demonstrator') || areas.includes('Reference Examples') || (impact.interaction_execution_impact || 0) >= 14) {
    checks.push('Interaction / Business Interaction と Execution / 実行契約への影響を確認。');
  }
  if (areas.includes('Evidence Architecture') || (impact.evidence_outcome_impact || 0) >= 8) {
    checks.push('Evidence / Outcome 表現・実行証跡の設計への影響を確認。');
  }
  if (areas.includes('Foundation') || areas.includes('Representation') || (impact.semantic_impact || 0) >= 14) {
    checks.push('Foundation / Representation の意味境界・能力表現への影響を確認。');
  }
  if (areas.includes('Binding') || areas.includes('Technology Profiles') || (impact.binding_ecosystem_impact || 0) >= 6) {
    checks.push('Binding / Technology Profile の接続実現方式（MCP / WebMCP / API 等）を確認。');
  }

  if (!checks.length) {
    checks.push(`${impact.company}の公式発表が ABIS 資産のどのレイヤーに触れるか、関連領域を横断確認。`);
  }

  const headline = title || impact.title || impact.event_id;
  return `${checks.slice(0, 2).join('\n')}${headline ? `\n（対象: ${headline}）` : ''}`;
}

export function buildReasoningSummaryJa(impact) {
  const parts = [];

  if (impact.binding_only_change) {
    parts.push(
      'ABISの意味層（semantic core）そのものを否定する内容ではありません。',
      '一方で、Binding / Technology Profile など実装・接続方式の変化により、Reference Example や Runtime Demonstrator の再評価が必要になる可能性があります。',
    );
  } else {
    if ((impact.semantic_impact || 0) >= 14) {
      parts.push('意味境界・能力表現（Foundation / Representation）への影響が想定されます。');
    }
    if ((impact.authority_impact || 0) >= 12) {
      parts.push('Business Authorization / 委任・同意モデルへの影響が想定されます。');
    }
    if ((impact.interaction_execution_impact || 0) >= 14) {
      parts.push('Agent-to-business Interaction や Execution Contract への影響が想定されます。');
    }
    if ((impact.evidence_outcome_impact || 0) >= 8) {
      parts.push('Evidence / Outcome 表現・監査可能性への影響が想定されます。');
    }
    if ((impact.binding_ecosystem_impact || 0) >= 6 && parts.length < 3) {
      parts.push('Technology Profile / Binding 層の接続実現方式の見直しが必要になる可能性があります。');
    }
  }

  if (impact.patent_flags?.length) {
    parts.push('標準化・参照アーキテクチャの重なりは人による確認対象（法的結論は出さない）。');
  }

  if (!parts.length) {
    parts.push('ABIS関連シグナルは限定的です。パターン追跡のため記録を継続します。');
  }

  return parts.slice(0, 4).join('\n');
}

function buildAnnouncementSummaryJa(title, excerpt) {
  if (!excerpt) return null;
  const clean = excerpt.replace(/\s+/g, ' ').trim();
  if (clean.length <= 120) return clean;
  return `${clean.slice(0, 119)}…`;
}

function buildConfirmationCandidates(impact) {
  const areas = impact.affected_areas || [];
  if (!areas.length) return ['・現時点で特定資産なし'];
  return areas.map((a) => `・${formatAffectedAreaJa(a)}`);
}

function shouldShowPatentSection(impact) {
  return (impact.standardization_patent_relevance || 0) >= 6 || (impact.patent_flags?.length || 0) > 0;
}

function buildPatentSection(impact) {
  const flags = impact.patent_flags || [];
  if (!flags.length) {
    return ['・標準化・参照アーキテクチャの観点で人による確認を推奨'];
  }
  return flags.map((f) => `・${PATENT_FLAG_JA[f] || f}`);
}

function buildHeader(impact) {
  const score = impact.abis_impact_score ?? 0;
  if (impact.severity === ABIS_SEVERITY.CRITICAL) {
    return `🚨 ABIS影響監視 — CRITICAL / ${score}`;
  }
  return `⚠️ ABIS影響監視 — HIGH / ${score}`;
}

/**
 * Japanese Slack message for ABIS Impact Watch (rendering only).
 */
export function formatSlackMessageJa(impact, options = {}) {
  const {
    title,
    ari_article_status = 'UNKNOWN',
    announcement_excerpt,
    compact = false,
  } = options;

  const displayTitle = title || impact.title || impact.event_id;
  const summaryJa = buildAnnouncementSummaryJa(displayTitle, announcement_excerpt);

  const blocks = [
    buildHeader(impact),
    '',
    '【要確認】',
    buildYokakunin(impact, displayTitle),
    '',
    '【発信元】',
    impact.company,
    '',
    '【発表内容】',
    displayTitle,
  ];

  if (summaryJa) {
    blocks.push('', summaryJa);
  }

  blocks.push(
    '',
    '【公開日】',
    formatSourceDate(impact.source_date),
    '',
    '【ABIS影響スコア】',
    `${impact.abis_impact_score} / 100`,
    '',
    'Severity:',
    impact.severity,
    '',
    '【影響が想定される領域】',
    ...buildConfirmationCandidates(impact).map((line) => line.replace(/^・/, '- ')),
    '',
    '【なぜ重要か】',
    buildReasoningSummaryJa(impact),
    '',
    '【推奨アクション】',
    formatRecommendedActionJa(impact.recommended_action),
    '',
    '【確認候補】',
    ...buildConfirmationCandidates(impact),
  );

  if (shouldShowPatentSection(impact)) {
    blocks.push('', '【標準化・特許観点】', ...buildPatentSection(impact));
  }

  if (!compact) {
    blocks.push(
      '',
      '【確度】',
      formatConfidenceJa(impact.confidence),
      '',
      '【ARI記事化】',
      formatAriStatusJa(ari_article_status),
    );
  }

  blocks.push('', '【一次情報】', impact.source_url || '不明');

  let text = blocks.join('\n');

  if (FORBIDDEN_PATENT_PHRASES.test(text)) {
    throw new Error('PATENT_LANGUAGE_UNSAFE');
  }

  if (compact || text.length > 3500) {
    const compactBlocks = [
      buildHeader(impact),
      '',
      '【要確認】',
      buildYokakunin(impact, displayTitle),
      '',
      '【発信元】',
      impact.company,
      '',
      '【発表内容】',
      displayTitle,
      '',
      '【ABIS影響スコア】',
      `${impact.abis_impact_score} / 100`,
      '',
      '【影響が想定される領域】',
      ...buildConfirmationCandidates(impact).map((line) => line.replace(/^・/, '- ')),
      '',
      '【なぜ重要か】',
      buildReasoningSummaryJa(impact),
      '',
      '【推奨アクション】',
      formatRecommendedActionJa(impact.recommended_action),
      '',
      '【一次情報】',
      impact.source_url || '不明',
    ];
    text = compactBlocks.join('\n');
  }

  return text;
}

/** @deprecated alias — use formatSlackMessageJa */
export function formatSlackMessage(impact, options = {}) {
  return formatSlackMessageJa(impact, options);
}

export function buildDryRunSampleMessage() {
  const impact = {
    event_id: 'dry-run-cloudflare-sample',
    company: 'Cloudflare',
    source_url: 'https://blog.cloudflare.com/example-agent-commerce-wallet/',
    source_date: '2026-08-08T09:00:00.000Z',
    abis_impact_score: 78,
    severity: ABIS_SEVERITY.HIGH,
    affected_areas: ['Binding', 'Technology Profiles', 'Reference Examples', 'Runtime Demonstrator'],
    semantic_impact: 8,
    authority_impact: 14,
    interaction_execution_impact: 16,
    evidence_outcome_impact: 6,
    binding_ecosystem_impact: 9,
    standardization_patent_relevance: 4,
    binding_only_change: false,
    patent_flags: [],
    recommended_action: RECOMMENDED_ACTIONS.REVIEW,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    title: 'Cloudflare announces Agent Commerce wallet and WebMCP execution controls',
  };

  return formatSlackMessageJa(impact, {
    title: impact.title,
    ari_article_status: 'READY_FOR_EDITORIAL_REVIEW · P1',
    announcement_excerpt:
      'Cloudflare describes wallet / payment integration and WebMCP-style execution controls for agent commerce flows.',
  });
}
