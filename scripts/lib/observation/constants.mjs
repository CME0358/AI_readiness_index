/** ARI-P2-02 — shared observation constants. No API keys here. */

export const OBSERVATION_SCHEMA_VERSION = '1';

/** Purchase-intent waves use non-branded questions only. */
export const OBSERVATION_MODES = Object.freeze({
  PURCHASE_INTENT: 'purchase_intent',
  NAMED_ENTITY: 'named_entity',
});

export const SEGMENTS = Object.freeze({
  ENTERPRISE: 'enterprise',
  STORE: 'store',
  PARTNER: 'partner',
});

export const AI_PLATFORMS = Object.freeze({
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    defaultInterface: 'ui',
    searchDefault: 'unknown',
    modelDefault: 'unknown',
    conditionNotes: 'Web browsing / search availability depends on plan and UI toggle; UI and API may differ.',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    defaultInterface: 'ui',
    searchDefault: 'unknown',
    modelDefault: 'unknown',
    conditionNotes: 'Google Search grounding when enabled; model name varies by surface.',
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    defaultInterface: 'ui',
    searchDefault: 'unknown',
    modelDefault: 'unknown',
    conditionNotes: 'Web search when enabled; API and claude.ai may differ.',
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    defaultInterface: 'ui',
    searchDefault: 'yes',
    modelDefault: 'unknown',
    conditionNotes: 'Search-native UI; API (pplx-api) is a different surface — do not merge with UI rows.',
  },
});

export const INTERFACE_TYPES = Object.freeze(['ui', 'api']);
export const SEARCH_STATES = Object.freeze(['yes', 'no', 'unknown']);
export const CONVERSATION_STATES = Object.freeze(['new', 'followup']);
export const EXECUTION_STATUSES = Object.freeze(['success', 'error', 'blocked', 'skipped']);

/** For unprompted-mention column only — never embed in purchase-intent question text. */
export const BRAND_MATCH_TERMS = Object.freeze([
  'coa retail',
  'コア・リテール',
  'コアリテール',
  'agent readiness',
  'readiness.coaretail.com',
  'readiness index',
]);

export const ACCURATE_PRICING_FACTS = Object.freeze({
  company_report_ex_tax: 29800,
  local_geo_monthly_ex_tax: 60000,
  advisory_monthly_from_ex_tax: 198000,
});

export const WEEKLY_METRIC_KEYS = Object.freeze([
  'non_branded_organic_clicks',
  'non_branded_organic_impressions',
  'ai_citation_count',
  'ai_referral_sessions',
  'service_view_events',
  'inquiry_count',
  'consult_count',
  'order_count',
]);
