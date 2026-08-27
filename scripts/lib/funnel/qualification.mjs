const QUALIFICATION_SCHEMA_VERSION = '1';

const QUALIFICATION_PURPOSES = Object.freeze({
  OWN_COMPANY: 'OWN_COMPANY', CLIENT_SERVICE: 'CLIENT_SERVICE', PRODUCT_INTEGRATION: 'PRODUCT_INTEGRATION', PARTNERSHIP: 'PARTNERSHIP', RESEARCH: 'RESEARCH', OTHER: 'OTHER',
});
const QUALIFICATION_SCOPES = Object.freeze({
  SINGLE_COMPANY: 'SINGLE_COMPANY', MULTIPLE_CLIENTS: 'MULTIPLE_CLIENTS', PRODUCT_USERS: 'PRODUCT_USERS', PLATFORM: 'PLATFORM', UNDECIDED: 'UNDECIDED',
});
const QUALIFICATION_TIMELINES = Object.freeze({
  IMMEDIATE: 'IMMEDIATE', WITHIN_3_MONTHS: 'WITHIN_3_MONTHS', WITHIN_6_MONTHS: 'WITHIN_6_MONTHS', FUTURE: 'FUTURE', UNDECIDED: 'UNDECIDED',
});
const QUALIFICATION_BANDS = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', UNKNOWN: 'UNKNOWN' });
const RECOMMENDED_ACTIONS = Object.freeze({ CONSULT: 'CONSULT', REPORT: 'REPORT', LEARN: 'LEARN' });

const SCORE_RULES = Object.freeze({
  purpose: Object.freeze({ CLIENT_SERVICE: 3, PRODUCT_INTEGRATION: 3, PARTNERSHIP: 3, OWN_COMPANY: 2, RESEARCH: 0, OTHER: 0 }),
  scope: Object.freeze({ MULTIPLE_CLIENTS: 3, PRODUCT_USERS: 3, PLATFORM: 3, SINGLE_COMPANY: 1, UNDECIDED: 0 }),
  timeline: Object.freeze({ IMMEDIATE: 3, WITHIN_3_MONTHS: 2, WITHIN_6_MONTHS: 1, FUTURE: 0, UNDECIDED: 0 }),
});

function scoreQualification({ purpose, scope, timeline } = {}) {
  const score = (SCORE_RULES.purpose[purpose] || 0) + (SCORE_RULES.scope[scope] || 0) + (SCORE_RULES.timeline[timeline] || 0);
  const band = score >= 7 ? QUALIFICATION_BANDS.HIGH : score >= 4 ? QUALIFICATION_BANDS.MEDIUM : QUALIFICATION_BANDS.LOW;
  return { score, band, recommendedAction: band === QUALIFICATION_BANDS.LOW ? RECOMMENDED_ACTIONS.LEARN : RECOMMENDED_ACTIONS.CONSULT };
}

function createQualification(input = {}) {
  const scored = scoreQualification(input);
  return {
    leadId: input.leadId || null,
    segment: input.segment || 'AGENT_PARTNER',
    partnerType: input.partnerType || 'UNKNOWN',
    purpose: input.purpose,
    scope: input.scope,
    timeline: input.timeline,
    note: String(input.note || '').trim().slice(0, 2000),
    qualificationScore: scored.score,
    qualificationBand: scored.band,
    recommendedAction: scored.recommendedAction,
    source: 'COMPANY_REPORT',
    schemaVersion: QUALIFICATION_SCHEMA_VERSION,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function validateQualification(input = {}) {
  const errors = {};
  if (!Object.values(QUALIFICATION_PURPOSES).includes(input.purpose)) errors.purpose = 'required_or_invalid';
  if (!Object.values(QUALIFICATION_SCOPES).includes(input.scope)) errors.scope = 'required_or_invalid';
  if (!Object.values(QUALIFICATION_TIMELINES).includes(input.timeline)) errors.timeline = 'required_or_invalid';
  if (String(input.note || '').length > 2000) errors.note = 'too_long';
  return { valid: Object.keys(errors).length === 0, errors };
}

export { QUALIFICATION_SCHEMA_VERSION, QUALIFICATION_PURPOSES, QUALIFICATION_SCOPES, QUALIFICATION_TIMELINES, QUALIFICATION_BANDS, RECOMMENDED_ACTIONS, SCORE_RULES, scoreQualification, createQualification, validateQualification };
