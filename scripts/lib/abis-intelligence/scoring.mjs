import {
  ABIS_SEVERITY,
  ABIS_SCORE_THRESHOLDS,
  RECOMMENDED_ACTIONS,
  CONFIDENCE_LEVELS,
  PATENT_FLAGS,
  ABIS_AFFECTED_ASSETS,
  DIMENSION_MAX,
} from './constants.mjs';

const KEYWORDS = {
  semantic: [
    'semantic', 'ontology', 'entity', 'capability', 'outcome', 'evidence',
    'representation', 'boundary', 'business capability', 'decision model',
  ],
  authority: [
    'authorization', 'authority', 'consent', 'delegated', 'policy',
    'permission', 'identity', 'trust', 'governance', 'approval',
  ],
  interaction: [
    'agent', 'interaction', 'execution', 'action', 'invoke', 'reservation',
    'commerce', 'transaction', 'checkout', 'booking', 'handoff', 'workflow',
  ],
  evidence: [
    'evidence', 'audit', 'provenance', 'verification', 'outcome record',
    'state transition', 'attestation', 'receipt', 'trace',
  ],
  binding: [
    'mcp', 'webmcp', 'openapi', 'x402', 'wallet', 'protocol', 'transport',
    'api', 'sdk', 'binding', 'connector',
  ],
  standardization: [
    'standard', 'specification', 'reference architecture', 'terminology',
    'convergence', 'patent', 'proposal', 'working group', 'ietf', 'w3c',
  ],
  bindingOnly: ['mcp', 'webmcp', 'transport', 'protocol update', 'sdk release'],
  lowImpact: [
    'benchmark', 'ui redesign', 'pricing', 'earnings', 'model release',
    'consumer feature', 'wallpaper', 'theme',
  ],
};

function countMatches(text, words) {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w)).length;
}

function clamp(n, max) {
  return Math.min(max, Math.max(0, n));
}

function scoreSemantic(text, matches) {
  if (matches.semantic >= 3) return 22;
  if (matches.semantic >= 2) return 16;
  if (matches.semantic >= 1) return 10;
  if (matches.interaction >= 2) return 8;
  return 2;
}

function scoreAuthority(text, matches) {
  if (matches.authority >= 3) return 18;
  if (matches.authority >= 2) return 14;
  if (matches.authority >= 1) return 9;
  if (text.includes('business context') || text.includes('delegated')) return 8;
  return 2;
}

function scoreInteraction(text, matches) {
  if (matches.interaction >= 4) return 18;
  if (matches.interaction >= 3) return 15;
  if (matches.interaction >= 2) return 11;
  if (matches.interaction >= 1) return 7;
  return 1;
}

function scoreEvidence(text, matches) {
  if (matches.evidence >= 2) return 13;
  if (matches.evidence >= 1) return 8;
  if (matches.interaction >= 2) return 5;
  return 1;
}

function scoreBinding(text, matches) {
  if (matches.binding >= 3) return 9;
  if (matches.binding >= 2) return 7;
  if (matches.binding >= 1) return 4;
  return 0;
}

function scoreStandardization(text, matches) {
  if (matches.standardization >= 2) return 8;
  if (matches.standardization >= 1) return 5;
  if (matches.binding >= 2 && matches.semantic === 0) return 2;
  return 1;
}

function isBindingOnlyChange(matches) {
  const core = matches.semantic + matches.authority + matches.interaction + matches.evidence;
  return matches.binding >= 1 && core === 0;
}

function isLowImpact(text, matches) {
  const lower = text.toLowerCase();
  if (KEYWORDS.lowImpact.some((w) => lower.includes(w))) return true;
  if (matches.interaction === 0 && matches.authority === 0 && matches.semantic === 0) {
    return matches.binding === 0;
  }
  return false;
}

function suggestAssets(matches, bindingOnly) {
  const areas = new Set();
  if (matches.semantic >= 1) {
    areas.add('Foundation');
    areas.add('Representation');
  }
  if (matches.authority >= 1) {
    areas.add('Governance');
    areas.add('Business Authorization Architecture');
  }
  if (matches.interaction >= 1) {
    areas.add('Runtime Demonstrator');
    areas.add('Reference Examples');
  }
  if (matches.evidence >= 1) areas.add('Evidence Architecture');
  if (matches.binding >= 1 || bindingOnly) {
    areas.add('Binding');
    areas.add('Technology Profiles');
  }
  if (areas.size === 0) areas.add('Foundation');
  return [...areas].filter((a) => ABIS_AFFECTED_ASSETS.includes(a));
}

function severityFromScore(score) {
  if (score >= ABIS_SCORE_THRESHOLDS.CRITICAL_MIN) return ABIS_SEVERITY.CRITICAL;
  if (score >= ABIS_SCORE_THRESHOLDS.HIGH_MIN) return ABIS_SEVERITY.HIGH;
  if (score >= ABIS_SCORE_THRESHOLDS.WATCH_MIN) return ABIS_SEVERITY.WATCH;
  return ABIS_SEVERITY.LOG_ONLY;
}

function recommendedAction(severity, bindingOnly) {
  if (severity === ABIS_SEVERITY.CRITICAL) return RECOMMENDED_ACTIONS.OPEN_REPOSITORY_TASK;
  if (severity === ABIS_SEVERITY.HIGH) return RECOMMENDED_ACTIONS.REVIEW;
  if (severity === ABIS_SEVERITY.WATCH) return bindingOnly ? RECOMMENDED_ACTIONS.MONITOR : RECOMMENDED_ACTIONS.MONITOR;
  return RECOMMENDED_ACTIONS.NO_ACTION;
}

function confidenceFromScore(score, matches) {
  if (score >= 80 && matches.semantic + matches.authority + matches.interaction >= 4) {
    return CONFIDENCE_LEVELS.HIGH;
  }
  if (score >= 55) return CONFIDENCE_LEVELS.MEDIUM;
  return CONFIDENCE_LEVELS.LOW;
}

function buildReasoningSummary(event, breakdown, bindingOnly, patentFlags) {
  const parts = [];
  if (bindingOnly) {
    parts.push('Binding/transport layer change detected; ABIS semantic layer not invalidated by transport alone.');
  }
  if (breakdown.interaction_execution >= 14) {
    parts.push('Potential impact on agent-to-business interaction or execution contracts.');
  }
  if (breakdown.authority >= 12) {
    parts.push('May affect business authorization, consent, or delegated authority models.');
  }
  if (breakdown.semantic_model >= 14) {
    parts.push('May touch semantic boundaries, capabilities, or outcome representation.');
  }
  if (patentFlags.length) {
    parts.push('Standardization or architecture overlap flagged for human review only (no legal conclusion).');
  }
  if (!parts.length) {
    parts.push('Limited ABIS-relevant signals; log for pattern tracking.');
  }
  return parts.join(' ');
}

export function scoreAbisImpact(event) {
  const blob = `${event.title} ${event.excerpt || ''}`;
  const matches = {
    semantic: countMatches(blob, KEYWORDS.semantic),
    authority: countMatches(blob, KEYWORDS.authority),
    interaction: countMatches(blob, KEYWORDS.interaction),
    evidence: countMatches(blob, KEYWORDS.evidence),
    binding: countMatches(blob, KEYWORDS.binding),
    standardization: countMatches(blob, KEYWORDS.standardization),
  };

  const bindingOnly = isBindingOnlyChange(matches);
  const lowImpact = isLowImpact(blob, matches);

  let semantic = scoreSemantic(blob, matches);
  let authority = scoreAuthority(blob, matches);
  let interaction = scoreInteraction(blob, matches);
  let evidence = scoreEvidence(blob, matches);
  let binding = scoreBinding(blob, matches);
  let standardization = scoreStandardization(blob, matches);

  if (bindingOnly) {
    semantic = clamp(semantic, 6);
    authority = clamp(authority, 4);
    standardization = clamp(standardization, 4);
  }

  if (lowImpact) {
    semantic = clamp(Math.floor(semantic / 2), DIMENSION_MAX.semantic_model);
    interaction = clamp(Math.floor(interaction / 2), DIMENSION_MAX.interaction_execution);
  }

  const breakdown = {
    semantic_model: clamp(semantic, DIMENSION_MAX.semantic_model),
    authority: clamp(authority, DIMENSION_MAX.authority),
    interaction_execution: clamp(interaction, DIMENSION_MAX.interaction_execution),
    evidence_outcome: clamp(evidence, DIMENSION_MAX.evidence_outcome),
    binding_ecosystem: clamp(binding, DIMENSION_MAX.binding_ecosystem),
    standardization_patent: clamp(standardization, DIMENSION_MAX.standardization_patent),
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const abis_impact_score = Math.min(100, total);
  const severity = severityFromScore(abis_impact_score);

  const patentFlags = [];
  if (breakdown.standardization_patent >= 6 || matches.standardization >= 2) {
    patentFlags.push(PATENT_FLAGS.POTENTIAL_OVERLAP_REVIEW);
    patentFlags.push(PATENT_FLAGS.HUMAN_REVIEW_RECOMMENDED);
  }

  const affected_areas = suggestAssets(matches, bindingOnly);

  return {
    event_id: event.event_id,
    company: event.company,
    source_url: event.url,
    source_date: event.published_date,
    abis_impact_score,
    severity,
    affected_areas,
    semantic_impact: breakdown.semantic_model,
    authority_impact: breakdown.authority,
    interaction_execution_impact: breakdown.interaction_execution,
    evidence_outcome_impact: breakdown.evidence_outcome,
    binding_ecosystem_impact: breakdown.binding_ecosystem,
    standardization_patent_relevance: breakdown.standardization_patent,
    breakdown,
    binding_only_change: bindingOnly,
    patent_flags: patentFlags,
    reasoning_summary: buildReasoningSummary(event, breakdown, bindingOnly, patentFlags),
    recommended_action: recommendedAction(severity, bindingOnly),
    confidence: confidenceFromScore(abis_impact_score, matches),
    scored_at: new Date().toISOString(),
  };
}
