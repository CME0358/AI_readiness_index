import { createLead } from './lead-schema.mjs';
import { parseAttribution } from './attribution.mjs';
import { classifyLead } from './classification.mjs';

const ROLE_VALUES = Object.freeze([
  'EXECUTIVE', 'MARKETING', 'WEB', 'DX', 'BUSINESS_DEVELOPMENT', 'ENGINEERING', 'SALES', 'OTHER', 'UNKNOWN',
]);

function normalizeDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return { valid: false, value: '', reason: 'required' };
  let candidate = raw;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { valid: false, value: '', reason: 'protocol' };
    if (url.username || url.password || !hostname || hostname === 'localhost' || hostname.endsWith('.local') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
      return { valid: false, value: '', reason: 'unsafe_host' };
    }
    const labels = hostname.split('.');
    if (!hostname.includes('.') || hostname.includes('..') || !/^[a-z0-9.-]+$/i.test(hostname) || hostname.startsWith('.') || hostname.endsWith('.') || labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) {
      return { valid: false, value: '', reason: 'invalid_host' };
    }
    return { valid: true, value: hostname.replace(/^www\./, '') };
  } catch {
    return { valid: false, value: '', reason: 'invalid_url' };
  }
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254 || email.includes('..')) return { valid: false, value: '', reason: 'invalid_email' };
  return { valid: true, value: email };
}

function normalizeRole(value) {
  const role = String(value || 'UNKNOWN').trim().toUpperCase();
  return ROLE_VALUES.includes(role) ? role : 'UNKNOWN';
}

function normalizeLeadCaptureForm(input = {}) {
  if (String(input.website || '').trim()) return { valid: false, errors: { website: 'spam' } };
  const company = String(input.company || '').trim();
  const domain = normalizeDomain(input.domain ?? input.url);
  const email = normalizeEmail(input.email);
  const errors = {};
  if (!company || company.length > 200) errors.company = 'required_or_too_long';
  if (!domain.valid) errors.domain = domain.reason;
  if (!email.valid) errors.email = email.reason;
  if (input.consent !== true && input.consent !== 'true' && input.consent !== 'on') errors.consent = 'required';
  if (Object.keys(errors).length) return { valid: false, errors };
  return {
    valid: true,
    value: {
      company,
      domain: domain.value,
      email: email.value,
      role: normalizeRole(input.role),
      industry: String(input.industry || '').trim().slice(0, 120),
      landingPage: String(input.landingPage || '').slice(0, 500),
      referrer: String(input.referrer || '').slice(0, 500),
      ctaId: String(input.ctaId || 'whitepaper_free_2026').slice(0, 120),
      ctaType: 'LEARN',
      source: String(input.source || '').slice(0, 200),
      medium: String(input.medium || '').slice(0, 200),
      campaign: String(input.campaign || '').slice(0, 200),
      firstTouch: input.firstTouch || null,
      lastTouch: input.lastTouch || null,
    },
  };
}

function buildWhitepaperLead(input, { now } = {}) {
  const normalized = normalizeLeadCaptureForm(input);
  if (!normalized.valid) return normalized;
  const value = normalized.value;
  const attribution = parseAttribution(input.query || '', {
    landingPage: value.landingPage,
    referrer: value.referrer,
    now,
  });
  const classification = classifyLead({ industry: value.industry, role: value.role, domain: value.domain });
  return {
    valid: true,
    lead: createLead({
      ...value,
      source: value.source || attribution.source,
      medium: value.medium || attribution.medium,
      campaign: value.campaign || attribution.campaign,
      firstTouch: value.firstTouch || attribution,
      lastTouch: value.lastTouch || attribution,
      segment: classification.segment,
      partnerType: classification.partnerType,
      directBuyerType: classification.directBuyerType,
    }),
    classification,
  };
}

export { ROLE_VALUES, normalizeDomain, normalizeEmail, normalizeRole, normalizeLeadCaptureForm, buildWhitepaperLead };
