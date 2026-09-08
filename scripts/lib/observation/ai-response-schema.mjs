import {
  AI_PLATFORMS,
  BRAND_MATCH_TERMS,
  CONVERSATION_STATES,
  EXECUTION_STATUSES,
  INTERFACE_TYPES,
  OBSERVATION_SCHEMA_VERSION,
  SEARCH_STATES,
} from './constants.mjs';
import { getQuestionById } from './purchase-intent-questions.mjs';

export const AI_RESPONSE_CSV_HEADERS = [
  'record_id',
  'wave_id',
  'observation_mode',
  'question_id',
  'question_text',
  'segment',
  'target_ai',
  'model_id',
  'search_enabled',
  'interface_type',
  'observed_at',
  'locale',
  'region',
  'conversation_state',
  'repeat_count',
  'execution_status',
  'error_code',
  'mentions_brand_unprompted',
  'recommends_vendor',
  'vendor_names',
  'citation_urls',
  'pricing_claim_accurate',
  'pricing_claim_notes',
  'has_consult_path',
  'consult_path_notes',
  'operator_notes',
];

const BOOL = new Set(['true', 'false', '1', '0', 'yes', 'no']);

function parseBool(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return null;
}

function splitList(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

function validateEnum(value, allowed, field) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!allowed.includes(v)) {
    return { ok: false, error: `${field} must be one of: ${allowed.join(', ')}` };
  }
  return { ok: true, value: v };
}

export function buildDefaultConditions({ questionId, targetAi, overrides = {} }) {
  const question = getQuestionById(questionId);
  if (!question) throw new Error(`Unknown question_id: ${questionId}`);
  const platform = AI_PLATFORMS[targetAi];
  if (!platform) throw new Error(`Unknown target_ai: ${targetAi}`);

  return {
    observation_mode: 'purchase_intent',
    question_id: question.id,
    question_text: question.text,
    segment: question.segment,
    target_ai: platform.id,
    model_id: overrides.model_id ?? platform.modelDefault,
    search_enabled: overrides.search_enabled ?? platform.searchDefault,
    interface_type: overrides.interface_type ?? platform.defaultInterface,
    locale: overrides.locale ?? 'ja-JP',
    region: overrides.region ?? 'JP',
    conversation_state: overrides.conversation_state ?? 'new',
    repeat_count: Number(overrides.repeat_count ?? 1),
  };
}

export function normalizeRecord(row, lineNumber = 0) {
  const errors = [];
  const record = { schema_version: OBSERVATION_SCHEMA_VERSION };

  for (const key of AI_RESPONSE_CSV_HEADERS) {
    record[key] = row[key] ?? '';
  }

  if (!record.record_id) errors.push('record_id is required');
  if (!record.wave_id) errors.push('wave_id is required');
  if (!record.question_id) errors.push('question_id is required');

  const q = getQuestionById(record.question_id);
  if (!q) errors.push(`unknown question_id: ${record.question_id}`);
  else if (record.question_text && record.question_text !== q.text) {
    errors.push(`question_text mismatch for ${record.question_id}`);
  } else {
    record.question_text = q.text;
    record.segment = q.segment;
  }

  if (!AI_PLATFORMS[record.target_ai]) errors.push(`unknown target_ai: ${record.target_ai}`);

  const iface = validateEnum(record.interface_type, INTERFACE_TYPES, 'interface_type');
  if (!iface.ok) errors.push(iface.error);
  else record.interface_type = iface.value;

  const search = validateEnum(record.search_enabled, SEARCH_STATES, 'search_enabled');
  if (!search.ok) errors.push(search.error);
  else record.search_enabled = search.value;

  const conv = validateEnum(record.conversation_state, CONVERSATION_STATES, 'conversation_state');
  if (!conv.ok) errors.push(conv.error);
  else record.conversation_state = conv.value;

  const status = validateEnum(record.execution_status, EXECUTION_STATUSES, 'execution_status');
  if (!status.ok) errors.push(status.error);
  else record.execution_status = status.value;

  record.repeat_count = Number(record.repeat_count || 1);
  if (!Number.isFinite(record.repeat_count) || record.repeat_count < 1) {
    errors.push('repeat_count must be >= 1');
  }

  record.mentions_brand_unprompted = parseBool(record.mentions_brand_unprompted);
  record.recommends_vendor = parseBool(record.recommends_vendor);
  record.has_consult_path = parseBool(record.has_consult_path);

  record.vendor_names = splitList(record.vendor_names);
  record.citation_urls = splitList(record.citation_urls);

  const pricingAcc = String(record.pricing_claim_accurate || 'n/a').toLowerCase();
  if (!['yes', 'no', 'unknown', 'n/a'].includes(pricingAcc)) {
    errors.push('pricing_claim_accurate must be yes|no|unknown|n/a');
  }
  record.pricing_claim_accurate = pricingAcc;

  record.valid_for_denominator = record.execution_status === 'success';
  record.line_number = lineNumber;

  return { record, errors };
}

export function detectUnpromptedBrandMention(text) {
  const lower = String(text || '').toLowerCase();
  return BRAND_MATCH_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

export function csvHeaderLine() {
  return AI_RESPONSE_CSV_HEADERS.join(',');
}
