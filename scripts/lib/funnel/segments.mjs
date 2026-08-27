/**
 * Canonical funnel segment taxonomy.
 * Keep UNKNOWN explicit so classification never has to guess.
 */

const SEGMENTS = Object.freeze({
  DIRECT_BUYER: 'DIRECT_BUYER',
  AGENT_PARTNER: 'AGENT_PARTNER',
  UNKNOWN: 'UNKNOWN',
});

const PARTNER_TYPES = Object.freeze({
  AGENCY: 'AGENCY',
  SAAS: 'SAAS',
  PLATFORM: 'PLATFORM',
  SI_DX: 'SI_DX',
  AI_COMPANY: 'AI_COMPANY',
  DATA_API: 'DATA_API',
  OTHER_PARTNER: 'OTHER_PARTNER',
  UNKNOWN: 'UNKNOWN',
});

const DIRECT_BUYER_TYPES = Object.freeze({
  DENTAL: 'DENTAL',
  CLINIC: 'CLINIC',
  BEAUTY: 'BEAUTY',
  ESTHETIC: 'ESTHETIC',
  FITNESS: 'FITNESS',
  LOCAL_SERVICE: 'LOCAL_SERVICE',
  RETAIL: 'RETAIL',
  OTHER_LOCAL: 'OTHER_LOCAL',
  UNKNOWN: 'UNKNOWN',
});

const isSegment = (value) => Object.values(SEGMENTS).includes(value);
const isPartnerType = (value) => Object.values(PARTNER_TYPES).includes(value);
const isDirectBuyerType = (value) => Object.values(DIRECT_BUYER_TYPES).includes(value);

export {
  SEGMENTS,
  PARTNER_TYPES,
  DIRECT_BUYER_TYPES,
  isSegment,
  isPartnerType,
  isDirectBuyerType,
};
