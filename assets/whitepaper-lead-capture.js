/* Free Whitepaper lead capture bridge. Server owns normalization/classification. */
(function () {
  var form = document.querySelector('[data-whitepaper-lead-form]');
  var success = document.querySelector('[data-whitepaper-lead-success]');
  var error = document.querySelector('[data-whitepaper-lead-error]');
  if (!form || !success) return;

  var ATTRIBUTION_KEY = 'ari_attribution_v1';
  var CTA_ID = 'whitepaper_free_2026';

  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    var safe = { page: window.location.pathname || '/whitepaper/2026/free/', cta_id: CTA_ID, cta_type: 'LEARN', schema_version: '1' };
    Object.keys(params || {}).forEach(function (key) {
      if (['email', 'company', 'domain', 'url', 'role', 'industry'].indexOf(key) === -1) safe[key] = params[key];
    });
    window.gtag('event', name, safe);
  }

  function attribution() {
    var params = new URLSearchParams(window.location.search);
    var current = {
      source: (params.get('utm_source') || '').slice(0, 200),
      medium: (params.get('utm_medium') || '').slice(0, 200),
      campaign: (params.get('utm_campaign') || '').slice(0, 200),
      content: (params.get('utm_content') || '').slice(0, 200),
      term: (params.get('utm_term') || '').slice(0, 200),
      landingPage: (window.location.pathname || '').slice(0, 500),
      referrer: (document.referrer || '').slice(0, 500),
      capturedAt: new Date().toISOString()
    };
    var saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY) || '{}'); } catch (_) {}
    if (!saved.firstTouch && Object.keys(current).some(function (key) { return current[key] && key !== 'capturedAt'; })) saved.firstTouch = current;
    saved.lastTouch = current;
    try { window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(saved)); } catch (_) {}
    return { firstTouch: saved.firstTouch || current, lastTouch: saved.lastTouch || current };
  }

  var touches = attribution();
  track('lead_capture_start');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var submit = form.querySelector('button[type="submit"]');
    if (submit && submit.disabled) return;
    if (submit) submit.disabled = true;
    if (error) error.hidden = true;
    var data = new FormData(form);
    var payload = {
      company: data.get('company'), domain: data.get('domain'), email: data.get('email'),
      role: data.get('role'), consent: data.get('consent') === 'on', website: data.get('website'),
      ctaId: CTA_ID, ctaType: 'LEARN', landingPage: window.location.pathname,
      referrer: document.referrer, query: window.location.search,
      firstTouch: touches.firstTouch, lastTouch: touches.lastTouch
    };
    fetch('/api/whitepaper-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) throw new Error(result.body.error || 'lead_capture_failed');
        form.hidden = true;
        success.hidden = false;
        track('lead_created', { segment: result.body.segment, partner_type: result.body.partnerType, direct_buyer_type: result.body.directBuyerType });
      })
      .catch(function () {
        if (error) { error.textContent = '送信を完了できませんでした。時間をおいて、もう一度お試しください。'; error.hidden = false; }
        if (submit) submit.disabled = false;
      });
  });

  var download = success.querySelector('[data-whitepaper-download]');
  if (download) download.addEventListener('click', function () { track('whitepaper_download'); });
})();
