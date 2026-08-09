/** Editorial Intelligence — status & threshold constants (RMVU-05D). */

export const EVENT_STATUSES = {
  DETECTED: 'DETECTED',
  SCORED: 'SCORED',
  DRAFTED: 'DRAFTED',
  VALIDATED: 'VALIDATED',
  READY_FOR_EDITORIAL_REVIEW: 'READY_FOR_EDITORIAL_REVIEW',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  IGNORE: 'IGNORE',
};

export const ARTICLE_TYPES = {
  BREAKING_ANALYSIS: 'BREAKING_ANALYSIS',
  CURRENT_EVENT_ANALYSIS: 'CURRENT_EVENT_ANALYSIS',
  EVERGREEN_UPDATE: 'EVERGREEN_UPDATE',
  EXISTING_ARTICLE_REFRESH: 'EXISTING_ARTICLE_REFRESH',
  RESEARCH_NOTE: 'RESEARCH_NOTE',
  IGNORE: 'IGNORE',
};

export const PRIORITY_BANDS = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
  MONITOR: 'MONITOR',
  IGNORE: 'IGNORE',
};

export const SOURCE_LEVEL = { A: 15, B: 10, C: 7, D: 3 };

export const SCORE_THRESHOLDS = {
  P0_MIN: 80,
  P1_MIN: 65,
  P2_MIN: 50,
  MONITOR_MIN: 35,
  DRAFT_MIN: 50,
};

export const ARI_LAYERS = [
  'Discovery',
  'Understanding',
  'Comparison',
  'Recommendation',
  'Actionability',
];

export const CLAIM_CLASSES = {
  VERIFIED: 'VERIFIED',
  INFERENCE: 'INFERENCE',
  ARI_INTERPRETATION: 'ARI INTERPRETATION',
  UNKNOWN: 'UNKNOWN',
};

export const SOURCE_HEALTH = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  FAILED: 'FAILED',
};

export const ABIS_BLOCK_TERMS = [
  'ABIS',
  'Agent Business Interaction Standard',
  'interaction-contract',
  'consent-data-design',
  'abis-intro',
  'abis-ari-bridge',
  'standards-landscape',
  'abis-readiness-gap',
];

export const DEFAULT_POLLING_HOURS = 12;
