const FUNNEL_EVENTS = Object.freeze({
  LANDING_VIEW: 'landing_view',
  INSIGHT_VIEW: 'insight_view',
  RESEARCH_VIEW: 'research_view',
  CTA_IMPRESSION: 'cta_impression',
  CTA_CLICK: 'cta_click',
  LEAD_CAPTURE_START: 'lead_capture_start',
  LEAD_CREATED: 'lead_created',
  WHITEPAPER_DOWNLOAD: 'whitepaper_download',
  REPORT_START: 'report_start',
  REPORT_FORM_COMPLETE: 'report_form_complete',
  REPORT_CHECKOUT_START: 'report_checkout_start',
  PURCHASE_VERIFIED: 'purchase_verified',
  REPORT_RESULT_VIEW: 'report_result_view',
  PARTNER_CTA_CLICK: 'partner_cta_click',
  LOCAL_CTA_CLICK: 'local_cta_click',
  ROUTING_DECISION: 'routing_decision',
  ROUTING_CTA_IMPRESSION: 'routing_cta_impression',
  ROUTING_CTA_CLICK: 'routing_cta_click',
});

const LEGACY_EVENT_MAP = Object.freeze({
  preview_visit: FUNNEL_EVENTS.LANDING_VIEW,
  report_start: FUNNEL_EVENTS.REPORT_START,
  preview_engaged: FUNNEL_EVENTS.CTA_CLICK,
  insight_cta_framework: FUNNEL_EVENTS.CTA_CLICK,
  insight_cta_research: FUNNEL_EVENTS.CTA_CLICK,
  insight_cta_report: FUNNEL_EVENTS.CTA_CLICK,
});

const SAFE_FIELDS = Object.freeze([
  'page', 'ctaId', 'ctaType', 'segment', 'partnerType', 'directBuyerType', 'source', 'medium', 'campaign', 'action', 'confidenceBand', 'destinationType', 'routeVersion', 'schemaVersion',
]);

function canonicalEventName(name) {
  return LEGACY_EVENT_MAP[name] || (Object.values(FUNNEL_EVENTS).includes(name) ? name : null);
}

function createEventPayload(event, input = {}) {
  const canonical = canonicalEventName(event);
  if (!canonical) return null;
  const payload = { event: canonical };
  for (const field of SAFE_FIELDS) {
    if (input[field] !== undefined && input[field] !== null) payload[field] = String(input[field]).slice(0, 200);
  }
  payload.schemaVersion = payload.schemaVersion || '1';
  return payload;
}

function createEventTracker(send = () => {}) {
  return (event, input = {}) => {
    const payload = createEventPayload(event, input);
    if (payload) send(payload);
    return payload;
  };
}

export { FUNNEL_EVENTS, LEGACY_EVENT_MAP, canonicalEventName, createEventPayload, createEventTracker };
