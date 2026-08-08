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
