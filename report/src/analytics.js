/**
 * TMVU-04 / RMVU-03 — ARI Report GA4 events (uses window.gtag from /assets/ga4.js).
 */

const REPORT_START_KEY = 'ari_report_start_sent';
const CONVERSION_KEY = 'ari_conversion_log_v1';

function recordConversion(conversionType, params = {}) {
  if (!conversionType) return null;
  const reference = params.externalReference || params.leadId || params.sessionId || `${conversionType}:${Date.now()}`;
  const key = `${conversionType}:${reference}`;
  let records = [];
  try { records = JSON.parse(localStorage.getItem(CONVERSION_KEY) || '[]'); } catch { records = []; }
  if (records.some((record) => record.key === key)) return records.find((record) => record.key === key);
  const record = { ...params, key, conversionType, value: conversionType === 'REPORT_PURCHASE' ? 29800 : null, currency: 'JPY', occurredAt: new Date().toISOString(), schemaVersion: '1' };
  delete record.email; delete record.company; delete record.domain; delete record.note;
  records = [...records.slice(-99), record];
  try { localStorage.setItem(CONVERSION_KEY, JSON.stringify(records)); } catch { /* optional storage */ }
  trackGaEvent('conversion', { conversion_type: conversionType, segment: record.segment, partner_type: record.partnerType, qualification_band: record.qualificationBand, cta_id: record.ctaId, cta_type: record.ctaType, source_page: record.sourcePage, insight_slug: record.insightSlug, value: record.value, currency: record.currency });
  return record;
}

export function trackGaEvent(name, params = {}) {
  if (typeof window.gtag !== 'function') return;
  const safe = { ...params };
  delete safe.email;
  delete safe.company;
  delete safe.url;
  window.gtag('event', name, {
    transport_type: 'beacon',
    ...safe,
  });
}

/** Fires once per browser tab session when user starts diagnosis (landing → form). */
export function trackReportStartOnce() {
  try {
    if (sessionStorage.getItem(REPORT_START_KEY) === '1') return;
    sessionStorage.setItem(REPORT_START_KEY, '1');
  } catch {
    /* noop */
  }

  trackGaEvent('report_start', {
    source: 'ari_report',
    page_path: window.location.pathname || '/report/',
  });
}

export function trackReportFormComplete() {
  trackGaEvent('report_form_complete', { source: 'ari_report' });
}

export function trackReportCheckoutStart(params = {}) {
  trackGaEvent('report_checkout_start', { source: 'ari_report', ...params });
}

export function trackPurchaseVerified(params = {}) {
  const { purchase_reference, ...analyticsParams } = params;
  trackGaEvent('purchase_verified', { source: 'ari_report', ...analyticsParams });
  if (params.verified === true && ['company_report_bundle', 'company_report_legacy', 'company_report'].includes(params.product_id)) recordConversion('REPORT_PURCHASE', { externalReference: purchase_reference || params.product_id, segment: params.segment, partnerType: params.partnerType, sourcePage: window.location.pathname || '/report/' });
}

export function trackReportResultView(params = {}) {
  trackGaEvent('report_result_view', { source: 'ari_report', ...params });
}

export { recordConversion };

export function trackResearchEntitlementOpen(params = {}) {
  trackGaEvent('research_entitlement_open', { source: 'ari_report', ...params });
}

export function trackHandbookUpgradeClick(params = {}) {
  trackGaEvent('handbook_upgrade_click', { source: 'ari_report', ...params });
}

/** Preview funnel — opaque token landing (/report/p/{token}) */
export async function hashPreviewToken(token) {
  if (!token || typeof token !== 'string') return 'none';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
  }
  return 'unavailable';
}

export function trackPreviewVisit(params = {}) {
  trackGaEvent('preview_visit', {
    source: 'ari_report',
    page_path: window.location.pathname || '/report/p/',
    ...params,
  });
}

export function trackPreviewEngaged(params = {}) {
  trackGaEvent('preview_engaged', { source: 'ari_report', ...params });
}

export function trackPreviewVideoImpression(params = {}) {
  trackGaEvent('preview_video_impression', { source: 'ari_report', ...params });
}

export function trackPreviewVideoPlay(params = {}) {
  trackGaEvent('preview_video_play', { source: 'ari_report', ...params });
}

export function trackPreviewVideoComplete(params = {}) {
  trackGaEvent('preview_video_complete', { source: 'ari_report', ...params });
}
