/* Free Whitepaper lead capture bridge. Server owns normalization/classification. */
(function () {
  var form = document.querySelector('[data-whitepaper-lead-form]');
  var success = document.querySelector('[data-whitepaper-lead-success]');
  var error = document.querySelector('[data-whitepaper-lead-error]');
  if (!form || !success) return;

  var ATTRIBUTION_KEY = 'ari_attribution_v1';
  var ROUTING_KEY = 'ari_routing_decision_v1';
  var CTA_ID = 'whitepaper_free_2026';

  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    var safe = { page: window.location.pathname || '/whitepaper/2026/free/', cta_id: CTA_ID, cta_type: 'LEARN', schema_version: '1' };
    Object.keys(params || {}).forEach(function (key) {
      if (['email', 'company', 'domain', 'url', 'role', 'industry'].indexOf(key) === -1) safe[key] = params[key];
    });
    window.gtag('event', name, safe);
  }

  function trackRouting(name, route, cta) {
    var params = {
      segment: route.segment, partner_type: route.partnerType, direct_buyer_type: route.directBuyerType,
      action: route.action, confidence_band: route.confidenceBand, cta_id: cta && cta.id,
      cta_type: cta && cta.type, destination_type: route.destinationType, route_version: route.version
    };
    track(name, params);
    if (name === 'routing_cta_click') recordConversion(route.action === 'LOCAL' ? 'DIRECT_BUYER_ROUTED' : route.action === 'REPORT' ? 'AGENT_PARTNER_ROUTED' : null, params);
  }

  function recordConversion(type, params) {
    if (!type) return;
    var key = type + ':' + (params && params.lead_id || Date.now());
    var records = [];
    try { records = JSON.parse(window.localStorage.getItem('ari_conversion_log_v1') || '[]'); } catch (_) {}
    if (records.some(function (record) { return record.key === key; })) return;
    var safe = { key: key, conversionType: type, value: null, currency: 'JPY', occurredAt: new Date().toISOString(), schemaVersion: '1' };
    Object.keys(params || {}).forEach(function (field) { if (['email', 'company', 'domain', 'name', 'note'].indexOf(field) === -1) safe[field] = params[field]; });
    records.push(safe);
    try { window.localStorage.setItem('ari_conversion_log_v1', JSON.stringify(records.slice(-100))); } catch (_) {}
    if (typeof window.gtag === 'function') window.gtag('event', 'conversion', { conversion_type: type, cta_id: safe.cta_id, cta_type: safe.cta_type, segment: safe.segment, partner_type: safe.partner_type, qualification_band: safe.qualification_band, source_page: safe.page, value: null, currency: 'JPY' });
  }

  function renderRouting(route) {
    var box = success.querySelector('[data-lead-routing]');
    var title = success.querySelector('[data-lead-routing-title]');
    var copy = success.querySelector('[data-lead-routing-copy]');
    var cta = success.querySelector('[data-lead-routing-cta]');
    if (!box || !title || !copy || !cta || !route) return;
    var recommendation = route.destinationType === 'LOCALGEO' ? {
      title: '店舗・地域ビジネス向けの改善プランを見る',
      copy: '地域ビジネス向けの改善プラン（¥60,000 / month）をご案内します。',
      label: '改善プランを見る', id: 'lead_routing_direct_buyer', type: 'LOCAL'
    } : route.destinationType === 'REPORT' ? {
      title: 'Company Reportで自社を詳しく調べる',
      copy: 'Company Report（¥29,800 税別）で、自社のAgent Readinessを詳しく調べられます。',
      label: 'Company Reportを見る', id: 'lead_routing_agent_partner', type: 'REPORT'
    } : {
      title: 'Frameworkから理解を深める',
      copy: 'ARIの考え方をFrameworkからご覧いただけます。',
      label: 'Frameworkを見る', id: 'lead_routing_unknown', type: 'LEARN'
    };
    title.textContent = recommendation.title;
    copy.textContent = recommendation.copy;
    cta.textContent = recommendation.label;
    cta.href = route.destination;
    cta.hidden = false;
    box.hidden = false;
    trackRouting('routing_cta_impression', route, recommendation);
    cta.addEventListener('click', function () { trackRouting('routing_cta_click', route, recommendation); });
    try { window.localStorage.setItem(ROUTING_KEY, JSON.stringify(route)); } catch (_) {}
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
        if (result.body.leadId) { try { window.localStorage.setItem('ari_lead_id', result.body.leadId); } catch (_) {} }
        if (result.body.storageRecordId) { try { window.localStorage.setItem('ari_lead_record_id', result.body.storageRecordId); } catch (_) {} }
        recordConversion('LEAD_CREATED', { lead_id: result.body.leadId, segment: result.body.segment, partner_type: result.body.partnerType, cta_id: CTA_ID, cta_type: 'LEARN', page: window.location.pathname });
        if (result.body.route) {
          trackRouting('routing_decision', result.body.route);
          renderRouting(result.body.route);
        }
      })
      .catch(function () {
        if (error) { error.textContent = '送信を完了できませんでした。時間をおいて、もう一度お試しください。'; error.hidden = false; }
        if (submit) submit.disabled = false;
      });
  });

  var download = success.querySelector('[data-whitepaper-download]');
  if (download) download.addEventListener('click', function () { track('whitepaper_download'); });
})();
