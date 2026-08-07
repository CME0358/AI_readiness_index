/**
 * TMVU-04 — ARI Report GA4 events (uses window.gtag from /assets/ga4.js).
 */

const REPORT_START_KEY = 'ari_report_start_sent';

export function trackGaEvent(name, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, {
    transport_type: 'beacon',
    ...params,
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
