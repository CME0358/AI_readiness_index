import { mapPreviewClassification } from './cta.mjs';
import { DIRECT_BUYER_TYPES, PARTNER_TYPES, SEGMENTS } from './segments.mjs';

const RULES = Object.freeze([
  { patterns: [/seo|geo|aeo|llmo|web.*agenc|digital.*market/i], segment: SEGMENTS.AGENT_PARTNER, partnerType: PARTNER_TYPES.AGENCY, signal: 'agency_service' },
  { patterns: [/saas|reservation.*saas|crm/i], segment: SEGMENTS.AGENT_PARTNER, partnerType: PARTNER_TYPES.SAAS, signal: 'saas' },
  { patterns: [/platform|marketplace|ota|commerce|ec/i], segment: SEGMENTS.AGENT_PARTNER, partnerType: PARTNER_TYPES.PLATFORM, signal: 'platform' },
  { patterns: [/sier|si.?er|dx/i], segment: SEGMENTS.AGENT_PARTNER, partnerType: PARTNER_TYPES.SI_DX, signal: 'si_dx' },
  { patterns: [/ai company|ai agent|人工知能|生成ai/i], segment: SEGMENTS.AGENT_PARTNER, partnerType: PARTNER_TYPES.AI_COMPANY, signal: 'ai_company' },
  { patterns: [/data|api provider|データ/i], segment: SEGMENTS.AGENT_PARTNER, partnerType: PARTNER_TYPES.DATA_API, signal: 'data_api' },
  { patterns: [/dental|歯科/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.DENTAL, signal: 'dental' },
  { patterns: [/clinic|クリニック|医療/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.CLINIC, signal: 'clinic' },
  { patterns: [/beauty|美容/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.BEAUTY, signal: 'beauty' },
  { patterns: [/esthetic|エステ/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.ESTHETIC, signal: 'esthetic' },
  { patterns: [/fitness|フィットネス/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.FITNESS, signal: 'fitness' },
  { patterns: [/retail|店舗|小売/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.RETAIL, signal: 'retail' },
  { patterns: [/local service|地域サービス/i], segment: SEGMENTS.DIRECT_BUYER, directBuyerType: DIRECT_BUYER_TYPES.LOCAL_SERVICE, signal: 'local_service' },
]);

function classifyLead(input = {}) {
  const preview = mapPreviewClassification(input.previewStrategy || input.buyerType);
  if (preview.segment !== SEGMENTS.UNKNOWN) {
    return { ...preview, confidence: 1, signals: ['explicit_preview_strategy'], source: 'PREVIEW_STRATEGY', version: '1' };
  }

  const text = [input.industry, input.businessType, input.company, input.domain].filter(Boolean).join(' ');
  const matches = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  if (matches.length !== 1) {
    return {
      segment: SEGMENTS.UNKNOWN,
      partnerType: PARTNER_TYPES.UNKNOWN,
      directBuyerType: DIRECT_BUYER_TYPES.UNKNOWN,
      confidence: 0,
      signals: matches.length > 1 ? ['ambiguous_signals'] : [],
      source: matches.length > 1 ? 'AMBIGUOUS' : 'NONE',
      version: '1',
    };
  }

  const rule = matches[0];
  return {
    segment: rule.segment,
    partnerType: rule.partnerType || PARTNER_TYPES.UNKNOWN,
    directBuyerType: rule.directBuyerType || DIRECT_BUYER_TYPES.UNKNOWN,
    confidence: 0.9,
    signals: [rule.signal],
    source: 'FORM_INDUSTRY',
    version: '1',
  };
}

export { classifyLead };
