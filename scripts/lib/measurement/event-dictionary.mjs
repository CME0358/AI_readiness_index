/**
 * ARI-P0-03 — Canonical funnel event dictionary (readiness.coaretail.com).
 * Maps P0 taxonomy to implemented GA4 event names. Does not claim live GA4 volumes.
 */

const MEASUREMENT_SCHEMA_VERSION = 'p0-03';

/** P0 canonical funnel events — definitions for reporting denominators. */
const CANONICAL_FUNNEL_EVENTS = Object.freeze({
  LANDING_VIEW: 'landing_view',
  SERVICE_VIEW: 'service_view',
  CTA_CLICK: 'cta_click',
  DIAGNOSIS_START: 'diagnosis_start',
  DIAGNOSIS_COMPLETE: 'diagnosis_complete',
  LEAD_SUBMIT_SUCCESS: 'lead_submit_success',
  BOOKING_CONFIRMED: 'booking_confirmed',
  PURCHASE: 'purchase',
});

/**
 * Primary GA4 implementation for each canonical event.
 * `status`: implemented | alias | not_connected
 */
const CANONICAL_IMPLEMENTATION = Object.freeze({
  landing_view: {
    status: 'implemented',
    primaryEvent: 'landing_view',
    source: 'assets/ga4.js',
    trigger: 'DOMContentLoaded on all pages',
    notEquivalentTo: [],
  },
  service_view: {
    status: 'implemented',
    primaryEvent: 'service_view',
    source: 'assets/ga4.js',
    trigger: 'DOMContentLoaded on commercial service surfaces only',
    notEquivalentTo: ['landing_view'],
  },
  cta_click: {
    status: 'implemented',
    primaryEvent: 'cta_click',
    source: 'assets/sitewide-cta-tracking.js',
    trigger: 'click on [data-funnel-cta]',
    notEquivalentTo: ['lead_submit_success', 'booking_confirmed', 'purchase'],
  },
  diagnosis_start: {
    status: 'alias',
    primaryEvent: 'report_start',
    aliasEvent: 'diagnosis_start',
    source: 'report/src/analytics.js',
    trigger: 'once per tab session when user starts Company Report diagnosis',
    notEquivalentTo: ['cta_click'],
  },
  diagnosis_complete: {
    status: 'alias',
    primaryEvent: 'report_result_view',
    aliasEvent: 'diagnosis_complete',
    alsoMaps: ['report_form_complete'],
    source: 'report/src/analytics.js',
    trigger: 'report_result_view when diagnosis results render; report_form_complete is pre-result only',
    notEquivalentTo: ['diagnosis_start', 'purchase'],
  },
  lead_submit_success: {
    status: 'alias',
    primaryEvent: 'lead_created',
    aliasEvent: 'lead_submit_success',
    source: 'assets/whitepaper-lead-capture.js',
    trigger: 'HTTP 201 from /api/whitepaper-lead only (not click)',
    notEquivalentTo: ['cta_click', 'lead_capture_start'],
  },
  booking_confirmed: {
    status: 'not_connected',
    primaryEvent: 'consult_booked',
    source: 'scripts/lib/funnel/conversions.mjs (type only)',
    trigger: 'requires external booking webhook — not fired on consult CTA click or schedule page view',
    notEquivalentTo: ['partner_consult_cta_click', 'cta_click'],
  },
  purchase: {
    status: 'alias',
    primaryEvent: 'purchase_verified',
    aliasEvent: 'purchase',
    source: 'report/src/analytics.js + api/verify-purchase.js',
    trigger: 'Stripe session verified server-side; client fires after 200 from /api/verify-purchase',
    notEquivalentTo: ['report_checkout_start', 'cta_click'],
  },
});

/** Legacy / domain-specific events retained for backward-compatible GA4 explorations. */
const LEGACY_TO_CANONICAL = Object.freeze({
  report_start: CANONICAL_FUNNEL_EVENTS.DIAGNOSIS_START,
  report_form_complete: 'diagnosis_form_complete',
  report_result_view: CANONICAL_FUNNEL_EVENTS.DIAGNOSIS_COMPLETE,
  lead_created: CANONICAL_FUNNEL_EVENTS.LEAD_SUBMIT_SUCCESS,
  purchase_verified: CANONICAL_FUNNEL_EVENTS.PURCHASE,
  consult_booked: CANONICAL_FUNNEL_EVENTS.BOOKING_CONFIRMED,
  preview_visit: CANONICAL_FUNNEL_EVENTS.LANDING_VIEW,
  insight_cta_framework: CANONICAL_FUNNEL_EVENTS.CTA_CLICK,
  insight_cta_research: CANONICAL_FUNNEL_EVENTS.CTA_CLICK,
  insight_cta_report: CANONICAL_FUNNEL_EVENTS.CTA_CLICK,
});

const SERVICE_VIEW_RULES = Object.freeze([
  { match: (pathname) => pathname.startsWith('/report/'), serviceKind: 'company_report', serviceId: 'report' },
  { match: (pathname) => pathname === '/improve.html', serviceKind: 'local_improve', serviceId: 'improve' },
  { match: (pathname) => pathname.startsWith('/research/'), serviceKind: 'research_hub', serviceId: 'research' },
  { match: (pathname) => pathname.startsWith('/whitepaper/'), serviceKind: 'whitepaper', serviceId: 'whitepaper' },
  { match: (pathname) => pathname.startsWith('/framework/'), serviceKind: 'framework', serviceId: 'framework' },
  { match: (pathname) => pathname.startsWith('/oisummit/'), serviceKind: 'oisummit', serviceId: 'oisummit' },
  { match: (pathname) => pathname.startsWith('/services/'), serviceKind: 'services_hub', serviceId: 'services' },
  { match: (pathname) => pathname.startsWith('/cases/'), serviceKind: 'case_study', serviceId: 'cases' },
  { match: (pathname) => pathname.startsWith('/sample/'), serviceKind: 'report_sample', serviceId: 'sample' },
]);

const AWARENESS_CHANNEL_VALUES = Object.freeze([
  'CHATGPT',
  'GEMINI',
  'COPILOT',
  'PERPLEXITY',
  'CLAUDE',
  'GROK',
  'SEARCH',
  'SNS',
  'REFERRAL',
  'OTHER',
]);

const OUTBOUND_MEASUREMENT_HANDOFFS = Object.freeze({
  localgeo: {
    domain: 'localgeo.coaretail.com',
    mechanism: 'outbound_link_with_utm',
    gaLinker: false,
    notes: 'UTM on href preserves last-touch; Local GEO GA4 is a separate property (not in this repo).',
  },
  consultSchedule: {
    domain: 'www.coaretail.com',
    path: '/readiness/mtgschedule',
    mechanism: 'outbound_link',
    gaLinker: false,
    bookingConfirmed: 'not_connected',
  },
});

const GA4_PROPERTY = Object.freeze({
  measurementId: 'G-BS30YQY1N7',
  gtm: false,
  crossDomainLinker: false,
});

/** Hostnames treated as non-production for debug_mode / traffic_type separation. */
function isNonProductionHost(hostname = '') {
  const host = String(hostname).toLowerCase();
  return !host
    || host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('.vercel.app')
    || host.includes('preview');
}

function resolveServiceView(pathname = '/') {
  const path = String(pathname || '/');
  for (const rule of SERVICE_VIEW_RULES) {
    if (rule.match(path)) return { serviceKind: rule.serviceKind, serviceId: rule.serviceId };
  }
  return null;
}

function normalizeAwarenessChannel(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  return AWARENESS_CHANNEL_VALUES.includes(raw) ? raw : 'OTHER';
}

export {
  MEASUREMENT_SCHEMA_VERSION,
  CANONICAL_FUNNEL_EVENTS,
  CANONICAL_IMPLEMENTATION,
  LEGACY_TO_CANONICAL,
  SERVICE_VIEW_RULES,
  AWARENESS_CHANNEL_VALUES,
  OUTBOUND_MEASUREMENT_HANDOFFS,
  GA4_PROPERTY,
  isNonProductionHost,
  resolveServiceView,
  normalizeAwarenessChannel,
};
