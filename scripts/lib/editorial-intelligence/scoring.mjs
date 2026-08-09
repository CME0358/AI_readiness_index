import { SOURCE_LEVEL, SCORE_THRESHOLDS, PRIORITY_BANDS } from './constants.mjs';

const KEYWORD_LAYERS = {
  Discovery: ['discover', 'index', 'crawl', 'search', 'visibility', 'find'],
  Understanding: ['understand', 'entity', 'knowledge', 'structured', 'schema', 'context'],
  Comparison: ['compare', 'rank', 'evaluate', 'benchmark'],
  Recommendation: ['recommend', 'suggest', 'answer', 'cite', 'generative'],
  Actionability: ['book', 'purchase', 'checkout', 'action', 'agent', 'api', 'execute'],
};

function scoreRecency(publishedDate, now = new Date()) {
  if (!publishedDate) return 2;
  const hours = (now.getTime() - new Date(publishedDate).getTime()) / 3_600_000;
  if (hours <= 24) return 20;
  if (hours <= 48) return 16;
  if (hours <= 72) return 12;
  if (hours <= 168) return 6;
  return 2;
}

function scoreSourceAuthority(sourceLevel) {
  return SOURCE_LEVEL[sourceLevel] ?? SOURCE_LEVEL.D;
}

function detectLayers(text) {
  const lower = (text || '').toLowerCase();
  return Object.entries(KEYWORD_LAYERS)
    .filter(([, words]) => words.some((w) => lower.includes(w)))
    .map(([layer]) => layer);
}

function scoreAriRelevance(text, layers) {
  const count = layers.length;
  if (count >= 4) return 22;
  if (count >= 3) return 18;
  if (count >= 2) return 12;
  if (count >= 1) return 8;
  return 3;
}

function scoreBusinessImpact(text, layers) {
  const lower = (text || '').toLowerCase();
  let score = 5;
  if (/customer|acquisition|booking|purchase|commerce|business|enterprise|visibility/i.test(lower)) score += 6;
  if (layers.includes('Recommendation') || layers.includes('Actionability')) score += 5;
  if (/ai search|generative|agent|assistant/i.test(lower)) score += 4;
  return Math.min(20, score);
}

function scoreSearchOpportunity(text) {
  const lower = (text || '').toLowerCase();
  if (/how to|what is|should|compare|vs|update|launch|announce/i.test(lower)) return 8;
  if (/new|feature|product|search|ai/i.test(lower)) return 5;
  return 2;
}

function scoreInterpretationPotential(layers) {
  if (layers.length >= 3) return 9;
  if (layers.length >= 2) return 7;
  if (layers.length >= 1) return 5;
  return 2;
}

export function scoreEvent(event, { now = new Date() } = {}) {
  const blob = `${event.title} ${event.excerpt || ''}`;
  const layers = detectLayers(blob);
  const sourceLevel = event.primary_source?.source_level || 'A';
  const breakdown = {
    source_authority: scoreSourceAuthority(sourceLevel),
    recency: scoreRecency(event.published_date, now),
    ari_relevance: scoreAriRelevance(blob, layers),
    business_impact: scoreBusinessImpact(blob, layers),
    search_opportunity: scoreSearchOpportunity(blob),
    interpretation_potential: scoreInterpretationPotential(layers),
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return {
    score: Math.min(100, total),
    breakdown,
    ari_layers: layers,
  };
}

export function priorityFromScore(score) {
  if (score >= SCORE_THRESHOLDS.P0_MIN) return PRIORITY_BANDS.P0;
  if (score >= SCORE_THRESHOLDS.P1_MIN) return PRIORITY_BANDS.P1;
  if (score >= SCORE_THRESHOLDS.P2_MIN) return PRIORITY_BANDS.P2;
  if (score >= SCORE_THRESHOLDS.MONITOR_MIN) return PRIORITY_BANDS.MONITOR;
  return PRIORITY_BANDS.IGNORE;
}

export function freshnessMultiplier(publishedDate, now = new Date()) {
  if (!publishedDate) return 0.4;
  const hours = (now.getTime() - new Date(publishedDate).getTime()) / 3_600_000;
  if (hours <= 24) return 1;
  if (hours <= 48) return 0.8;
  if (hours <= 72) return 0.6;
  if (hours <= 168) return 0.4;
  return 0.2;
}

export function effectivePriority(basePriority, publishedDate, now = new Date()) {
  const mult = freshnessMultiplier(publishedDate, now);
  if (basePriority === PRIORITY_BANDS.P0 && mult < 0.6) return PRIORITY_BANDS.P1;
  if (basePriority === PRIORITY_BANDS.P1 && mult < 0.4) return PRIORITY_BANDS.P2;
  if (mult <= 0.2 && (basePriority === PRIORITY_BANDS.P0 || basePriority === PRIORITY_BANDS.P1)) {
    return PRIORITY_BANDS.P2;
  }
  return basePriority;
}
