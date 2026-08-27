const CONVERSION_TYPES = Object.freeze({
  LEAD_CREATED: 'LEAD_CREATED',
  DIRECT_BUYER_ROUTED: 'DIRECT_BUYER_ROUTED',
  AGENT_PARTNER_ROUTED: 'AGENT_PARTNER_ROUTED',
  REPORT_PURCHASE: 'REPORT_PURCHASE',
  PARTNER_QUALIFIED: 'PARTNER_QUALIFIED',
  CONSULT_CLICK: 'CONSULT_CLICK',
  CONSULT_BOOKED: 'CONSULT_BOOKED',
  BACKEND_OPPORTUNITY: 'BACKEND_OPPORTUNITY',
  LOCAL_CONVERSION: 'LOCAL_CONVERSION',
});

const REPORT_VALUE_JPY = 29_800;
const CONVERSION_SCHEMA_VERSION = '1';

const EVENT_CONVERSION_MAP = Object.freeze({
  lead_created: CONVERSION_TYPES.LEAD_CREATED,
  partner_qualification_complete: CONVERSION_TYPES.PARTNER_QUALIFIED,
  partner_consult_cta_click: CONVERSION_TYPES.CONSULT_CLICK,
});

function mapEventToConversion(event, input = {}) {
  if (event === 'routing_cta_click' && input.action === 'LOCAL') return CONVERSION_TYPES.DIRECT_BUYER_ROUTED;
  if (event === 'routing_cta_click' && input.action === 'REPORT') return CONVERSION_TYPES.AGENT_PARTNER_ROUTED;
  if (event === 'purchase_verified' && input.verified === true && (input.product_id === 'company_report_bundle' || input.product_id === 'company_report_legacy' || input.product_id === 'company_report')) return CONVERSION_TYPES.REPORT_PURCHASE;
  return EVENT_CONVERSION_MAP[event] || null;
}

function conversionKey(record) {
  const reference = record.externalReference || record.leadId || `${record.occurredAt}:${record.conversionType}`;
  return `${record.conversionType}:${reference}`;
}

function createConversion(input = {}) {
  const conversionType = String(input.conversionType || '');
  if (!Object.values(CONVERSION_TYPES).includes(conversionType)) return null;
  const isReportPurchase = conversionType === CONVERSION_TYPES.REPORT_PURCHASE;
  return {
    conversionId: input.conversionId || null,
    leadId: input.leadId || '',
    conversionType,
    segment: input.segment || '',
    partnerType: input.partnerType || '',
    qualificationBand: input.qualificationBand || '',
    firstTouch: input.firstTouch || {},
    lastTouch: input.lastTouch || {},
    sourcePage: String(input.sourcePage || '').slice(0, 500),
    insightSlug: String(input.insightSlug || '').slice(0, 120),
    ctaId: String(input.ctaId || '').slice(0, 120),
    ctaType: String(input.ctaType || '').slice(0, 40),
    value: isReportPurchase ? REPORT_VALUE_JPY : (input.value ?? null),
    currency: isReportPurchase ? 'JPY' : (input.currency || 'JPY'),
    externalReference: String(input.externalReference || '').slice(0, 200),
    occurredAt: input.occurredAt || new Date().toISOString(),
    schemaVersion: CONVERSION_SCHEMA_VERSION,
  };
}

function createConversionRepository({ saveConversion, findConversion } = {}) {
  if (typeof saveConversion !== 'function' || typeof findConversion !== 'function') throw new TypeError('ConversionRepository requires saveConversion and findConversion adapters');
  return Object.freeze({
    saveConversion: async (input) => {
      const conversion = input?.conversionType ? createConversion(input) : input;
      if (!conversion) return { saved: false, reason: 'invalid_conversion' };
      const key = conversionKey(conversion);
      if (await findConversion(key)) return { saved: false, duplicate: true, key, conversion };
      return saveConversion(conversion, key);
    },
    findConversion,
  });
}

export { CONVERSION_TYPES, REPORT_VALUE_JPY, CONVERSION_SCHEMA_VERSION, EVENT_CONVERSION_MAP, mapEventToConversion, conversionKey, createConversion, createConversionRepository };
