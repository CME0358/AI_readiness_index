/** Private ABIS Impact Watch — thresholds & enums (RMVU-05D Extension). */

export const ABIS_SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  WATCH: 'WATCH',
  LOG_ONLY: 'LOG_ONLY',
};

export const ABIS_SCORE_THRESHOLDS = {
  CRITICAL_MIN: 85,
  HIGH_MIN: 70,
  WATCH_MIN: 50,
};

export const RECOMMENDED_ACTIONS = {
  NO_ACTION: 'NO_ACTION',
  MONITOR: 'MONITOR',
  REVIEW: 'REVIEW',
  CREATE_RESEARCH_NOTE: 'CREATE_RESEARCH_NOTE',
  OPEN_REPOSITORY_TASK: 'OPEN_REPOSITORY_TASK',
};

export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const PATENT_FLAGS = {
  POTENTIAL_OVERLAP_REVIEW: 'POTENTIAL_OVERLAP_REVIEW',
  HUMAN_REVIEW_RECOMMENDED: 'HUMAN_REVIEW_RECOMMENDED',
};

export const ABIS_AFFECTED_ASSETS = [
  'Foundation',
  'Representation',
  'Governance',
  'Binding',
  'Technology Profiles',
  'Reference Examples',
  'Runtime Demonstrator',
  'Evidence Architecture',
  'Business Authorization Architecture',
];

export const NOTIFY_SEVERITIES = new Set([ABIS_SEVERITY.CRITICAL, ABIS_SEVERITY.HIGH]);

export const DIMENSION_MAX = {
  semantic_model: 25,
  authority: 20,
  interaction_execution: 20,
  evidence_outcome: 15,
  binding_ecosystem: 10,
  standardization_patent: 10,
};
