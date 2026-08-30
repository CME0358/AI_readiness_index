/**
 * OISUMMIT GA4 events — no PII in parameters.
 */
(function (w) {
  'use strict';

  var ATTRIBUTION_KEY = 'ari_attribution_v1';

  function parseMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') || '' : '';
  }

  function captureAttribution() {
    var query = new URLSearchParams(w.location.search);
    var touch = {
      source: (query.get('utm_source') || '').slice(0, 200),
      medium: (query.get('utm_medium') || '').slice(0, 200),
      campaign: (query.get('utm_campaign') || '').slice(0, 200),
      content: (query.get('utm_content') || '').slice(0, 200),
      term: (query.get('utm_term') || '').slice(0, 200),
      landingPage: (w.location.pathname || '/').slice(0, 500),
      referrer: (document.referrer || '').slice(0, 500),
      capturedAt: new Date().toISOString(),
    };
    var saved = {};
    try { saved = JSON.parse(w.localStorage.getItem(ATTRIBUTION_KEY) || '{}'); } catch (_) {}
    if (!saved.firstTouch && Object.keys(touch).some(function (k) { return touch[k] && k !== 'capturedAt'; })) {
      saved.firstTouch = touch;
    }
    saved.lastTouch = touch;
    try { w.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(saved)); } catch (_) {}
    return touch;
  }

  function track(name, params) {
    if (typeof w.gtag !== 'function') return;
    var safe = Object.assign({
      page_path: w.location.pathname || '/',
      transport_type: 'beacon',
    }, params || {});
    ['name', 'email', 'company', 'message', 'domain'].forEach(function (key) { delete safe[key]; });
    w.gtag('event', name, safe);
  }

  var segment = parseMeta('ari:oisummit-segment') || 'general';
  var utmContent = new URLSearchParams(w.location.search).get('utm_content') || segment;

  captureAttribution();
  track('oisummit_lp_view', { segment: segment, utm_content: utmContent });

  w.oisummitTrack = track;

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-oisummit-cta]');
    if (!link) return;
    track('oisummit_cta_click', {
      segment: link.getAttribute('data-segment') || segment,
      cta_type: link.getAttribute('data-cta-type') || 'link',
      utm_content: utmContent,
    });
  });

  document.querySelectorAll('[data-oisummit-segment-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      track('segment_selected', {
        segment: tab.getAttribute('data-segment') || '',
        utm_content: utmContent,
      });
    });
  });

  document.querySelectorAll('[data-oisummit-meeting]').forEach(function (link) {
    link.addEventListener('click', function () {
      track('oisummit_meeting_click', {
        segment: link.getAttribute('data-segment') || segment,
        cta_type: 'meeting',
        utm_content: utmContent,
      });
    });
  });
})(window);
