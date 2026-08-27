import { DIRECT_BUYER_TYPES, PARTNER_TYPES, SEGMENTS } from './segments.mjs';

const LEAD_SCHEMA_VERSION = '1';

function createCanonicalLeadId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return `lead_${randomUUID.call(globalThis.crypto)}`;
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

const emptyTouch = () => ({
  source: '',
  medium: '',
  campaign: '',
  content: '',
  term: '',
  landingPage: '',
  referrer: '',
  capturedAt: '',
});

function createLead(input = {}) {
  const now = new Date().toISOString();
  return {
    leadId: input.leadId || createCanonicalLeadId(),
    company: String(input.company || ''),
    domain: String(input.domain || ''),
    email: String(input.email || ''),
    industry: String(input.industry || ''),
    role: String(input.role || ''),
    segment: input.segment || SEGMENTS.UNKNOWN,
    partnerType: input.partnerType || PARTNER_TYPES.UNKNOWN,
    directBuyerType: input.directBuyerType || DIRECT_BUYER_TYPES.UNKNOWN,
    source: String(input.source || ''),
    medium: String(input.medium || ''),
    campaign: String(input.campaign || ''),
    landingPage: String(input.landingPage || ''),
    referrer: String(input.referrer || ''),
    firstTouch: input.firstTouch || emptyTouch(),
    lastTouch: input.lastTouch || emptyTouch(),
    ctaId: String(input.ctaId || ''),
    ctaType: String(input.ctaType || ''),
    consentType: input.consentType || 'SERVICE_ONLY',
    consentVersion: String(input.consentVersion || '1'),
    consentedAt: input.consentedAt || now,
    consentSource: String(input.consentSource || 'WHITEPAPER'),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    schemaVersion: LEAD_SCHEMA_VERSION,
  };
}

function validateLead(lead) {
  const required = ['company', 'domain', 'email', 'industry', 'role', 'segment', 'partnerType', 'directBuyerType', 'firstTouch', 'lastTouch', 'schemaVersion'];
  const missing = required.filter((field) => !(field in (lead || {})));
  return { valid: missing.length === 0 && lead?.schemaVersion === LEAD_SCHEMA_VERSION, missing };
}

export { LEAD_SCHEMA_VERSION, createCanonicalLeadId, createLead, validateLead };
