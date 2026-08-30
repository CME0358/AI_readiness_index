import { createLead } from './lead-schema.mjs';
import { parseAttribution } from './attribution.mjs';
import { SEGMENTS, PARTNER_TYPES, DIRECT_BUYER_TYPES } from './segments.mjs';

const OISUMMIT_SEGMENTS = Object.freeze(['enterprise', 'public', 'tech']);
const INTEREST_BY_SEGMENT = Object.freeze({
  enterprise: [
    'AIからの認識・推薦',
    'Agent Readiness評価',
    'Enterprise Assessment',
    'PoC',
    'その他',
  ],
  public: [
    'AIによる行政情報案内',
    '公開情報のAgent Readiness',
    'MAR Assessment',
    '実証実験',
    'その他',
  ],
  tech: [
    'AI Agent Integration',
    'Agent Execution',
    'PoC',
    'Joint Research',
    'Partnership',
  ],
});
const ORG_TYPES = Object.freeze(['SIer', 'SaaS', 'AI Platform', 'Enterprise IT', 'Consulting', 'Other']);

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254 || email.includes('..')) {
    return { valid: false, value: '', reason: 'invalid_email' };
  }
  return { valid: true, value: email };
}

function domainFromEmail(email) {
  const part = String(email || '').split('@')[1] || '';
  return part.replace(/^www\./, '').slice(0, 200);
}

function normalizeOisummitLeadForm(input = {}) {
  if (String(input.website || '').trim()) return { valid: false, errors: { website: 'spam' } };

  const segment = String(input.segment || '').trim().toLowerCase();
  if (!OISUMMIT_SEGMENTS.includes(segment)) return { valid: false, errors: { segment: 'invalid_segment' } };

  const company = String(input.company || '').trim();
  const name = String(input.name || '').trim();
  const department = String(input.department || '').trim();
  const email = normalizeEmail(input.email);
  const interest = String(input.interest || '').trim();
  const message = String(input.message || '').trim();
  const orgType = String(input.orgType || '').trim();
  const errors = {};

  if (!company || company.length > 200) errors.company = 'required_or_too_long';
  if (!name || name.length > 120) errors.name = 'required_or_too_long';
  if (!email.valid) errors.email = email.reason;
  if (!interest || !INTEREST_BY_SEGMENT[segment].includes(interest)) errors.interest = 'invalid_interest';
  if (message.length > 2000) errors.message = 'too_long';
  if (segment === 'tech' && orgType && !ORG_TYPES.includes(orgType)) errors.orgType = 'invalid_org_type';
  if (input.consent !== true && input.consent !== 'true' && input.consent !== 'on') errors.consent = 'required';

  if (Object.keys(errors).length) return { valid: false, errors };

  const domain = domainFromEmail(email.value);
  if (!domain) return { valid: false, errors: { email: 'invalid_email_domain' } };

  const role = segment === 'tech' ? (orgType || 'ENGINEERING') : 'OTHER';
  const industryParts = [interest];
  if (name) industryParts.push(`name:${name.slice(0, 40)}`);
  if (department) industryParts.push(department);
  if (orgType) industryParts.push(orgType);
  if (message) industryParts.push(`msg:${message.slice(0, 500)}`);

  return {
    valid: true,
    value: {
      segment,
      company,
      name,
      department,
      domain,
      email: email.value,
      interest,
      message,
      orgType,
      role,
      industry: industryParts.join(' | ').slice(0, 120),
      landingPage: String(input.landingPage || '').slice(0, 500),
      referrer: String(input.referrer || '').slice(0, 500),
      ctaId: String(input.ctaId || `oisummit_${segment}_form`).slice(0, 120),
      ctaType: 'CONSULT',
      source: String(input.source || '').slice(0, 200),
      medium: String(input.medium || '').slice(0, 200),
      campaign: String(input.campaign || '').slice(0, 200),
      content: String(input.content || '').slice(0, 200),
      firstTouch: input.firstTouch || null,
      lastTouch: input.lastTouch || null,
    },
  };
}

function buildOisummitLead(input, { now } = {}) {
  const normalized = normalizeOisummitLeadForm(input);
  if (!normalized.valid) return normalized;

  const value = normalized.value;
  const attribution = parseAttribution(input.query || '', {
    landingPage: value.landingPage,
    referrer: value.referrer,
    now,
  });

  const partnerType = value.segment === 'tech'
    ? (value.orgType === 'SIer' ? PARTNER_TYPES.SI_DX : PARTNER_TYPES.PLATFORM)
    : PARTNER_TYPES.UNKNOWN;
  const directBuyerType = value.segment === 'enterprise'
    ? DIRECT_BUYER_TYPES.OTHER_LOCAL
    : DIRECT_BUYER_TYPES.UNKNOWN;
  const segmentMap = {
    enterprise: SEGMENTS.DIRECT_BUYER,
    public: SEGMENTS.UNKNOWN,
    tech: SEGMENTS.AGENT_PARTNER,
  };

  return {
    valid: true,
    lead: createLead({
      company: value.company,
      domain: value.domain,
      email: value.email,
      industry: value.industry,
      role: value.role,
      segment: segmentMap[value.segment] || SEGMENTS.UNKNOWN,
      partnerType,
      directBuyerType,
      source: value.source || attribution.source || 'oisummit',
      medium: value.medium || attribution.medium || 'qr',
      campaign: value.campaign || attribution.campaign || 'oisummit2026',
      landingPage: value.landingPage,
      referrer: value.referrer,
      firstTouch: value.firstTouch || attribution,
      lastTouch: value.lastTouch || attribution,
      ctaId: value.ctaId,
      ctaType: value.ctaType,
      consentType: 'SERVICE_ONLY',
      consentVersion: '1',
      consentSource: 'OISUMMIT',
    }),
    meta: {
      oisummitSegment: value.segment,
      contactName: value.name,
      department: value.department,
      interest: value.interest,
      message: value.message,
      orgType: value.orgType,
    },
  };
}

export {
  OISUMMIT_SEGMENTS,
  INTEREST_BY_SEGMENT,
  ORG_TYPES,
  normalizeOisummitLeadForm,
  buildOisummitLead,
};
