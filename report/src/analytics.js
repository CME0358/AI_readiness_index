/**
 * TMVU-04 / RMVU-03 — ARI Report GA4 events (uses window.gtag from /assets/ga4.js).
 */

const REPORT_START_KEY = 'ari_report_start_sent';

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
  trackGaEvent('purchase_verified', { source: 'ari_report', ...params });
}

export function trackReportResultView(params = {}) {
  trackGaEvent('report_result_view', { source: 'ari_report', ...params });
}

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
