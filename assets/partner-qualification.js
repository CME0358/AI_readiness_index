/* Verified Company Report customers only. Qualification never controls report access. */
(function () {
  var section = document.querySelector('[data-partner-qualification]');
  var form = document.querySelector('[data-partner-qualification-form]');
  if (!section || !form) return;
  var result = section.querySelector('[data-partner-qualification-result]');
  var error = section.querySelector('[data-partner-qualification-error]');
  var ux = window.AriFormUx || {};
  var FIELD_MESSAGES = {
    purpose: { required_or_invalid: '利用目的を選択してください。', default: '利用目的を選択してください。' },
    scope: { required_or_invalid: '導入対象を選択してください。', default: '導入対象を選択してください。' },
    timeline: { required_or_invalid: '検討時期を選択してください。', default: '検討時期を選択してください。' },
    note: { too_long: '補足は2000文字以内で入力してください。', default: '補足を確認してください。' },
    _fallback: '入力内容を確認してください。',
  };
  var purchase;
  try { purchase = JSON.parse(window.localStorage.getItem('ari_purchase_state') || 'null'); } catch (_) { purchase = null; }
  var eligibleIds = ['company_report_bundle', 'company_report_legacy'];
  if (!purchase || purchase.verified !== true || !purchase.entitlements || purchase.entitlements.companyReport !== true || eligibleIds.indexOf(purchase.productId) === -1) return;
  if (purchase.expiresAt && Date.now() > purchase.expiresAt) return;
  section.classList.add('is-eligible');
  function attribution() {
    try {
      var saved = JSON.parse(window.localStorage.getItem('ari_attribution_v1') || '{}');
      var first = saved.firstTouch || {};
      var last = saved.lastTouch || first;
      return {
        firstTouch: first, lastTouch: last,
        source: last.source || first.source || '', medium: last.medium || first.medium || '', campaign: last.campaign || first.campaign || '',
        insightSlug: last.insightSlug || first.insightSlug || '', ctaId: last.ctaId || first.ctaId || '', ctaType: last.ctaType || first.ctaType || '', editorialIntent: last.editorialIntent || first.editorialIntent || ''
      };
    } catch (_) { return { firstTouch: {}, lastTouch: {} }; }
  }
  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    var touch = attribution();
    var safe = { source: 'company_report', schema_version: '1', medium: touch.medium, campaign: touch.campaign, insight_slug: touch.insightSlug, cta_id: touch.ctaId, cta_type: touch.ctaType, editorial_intent: touch.editorialIntent };
    Object.keys(params || {}).forEach(function (key) { if (['email', 'company', 'domain', 'name', 'note'].indexOf(key) === -1) safe[key] = params[key]; });
    window.gtag('event', name, safe);
  }
  track('partner_qualification_view');
  var started = false;
  form.addEventListener('focusin', function () { if (!started) { started = true; track('partner_qualification_start'); } });

  var submitButton = form.querySelector('button[type="submit"]');
  var submitState = typeof ux.bindSubmitButton === 'function'
    ? ux.bindSubmitButton(submitButton, { busyLabel: '送信中…', idleLabel: submitButton ? submitButton.textContent : '' })
    : { busy: function () { if (submitButton) submitButton.disabled = true; }, idle: function () { if (submitButton) submitButton.disabled = false; } };

  function showClientValidationErrors(payload) {
    var fields = {};
    if (!payload.purpose) fields.purpose = 'required_or_invalid';
    if (!payload.scope) fields.scope = 'required_or_invalid';
    if (!payload.timeline) fields.timeline = 'required_or_invalid';
    if (typeof ux.mapServerFields === 'function') return ux.mapServerFields(form, fields, FIELD_MESSAGES);
    return false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submitButton && submitButton.disabled) return;
    if (typeof ux.clearFieldErrors === 'function') ux.clearFieldErrors(form);
    if (error) error.hidden = true;
    var data = new FormData(form);
    var payload = { sessionId: purchase.sessionId, leadId: '', leadRecordId: '', purpose: data.get('purpose'), scope: data.get('scope'), timeline: data.get('timeline'), note: data.get('note') };
    try { payload.leadId = window.localStorage.getItem('ari_lead_id') || ''; } catch (_) {}
    try { payload.leadRecordId = window.localStorage.getItem('ari_lead_record_id') || ''; } catch (_) {}
    if (!payload.purpose || !payload.scope || !payload.timeline) {
      showClientValidationErrors(payload);
      if (error) { error.textContent = '利用目的・導入対象・検討時期を選択してください。'; error.hidden = false; }
      return;
    }
    submitState.busy();
    fetch('/api/partner-qualification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, status: response.status, body: body }; }); })
      .then(function (response) {
        if (!response.ok) {
          if (response.status === 400 && response.body && response.body.fields && typeof ux.mapServerFields === 'function') {
            ux.mapServerFields(form, response.body.fields, FIELD_MESSAGES);
            if (error) {
              error.textContent = response.body.error === 'invalid_qualification'
                ? '入力内容を確認してください。'
                : '送信を完了できませんでした。入力内容は保持されています。もう一度お試しください。';
              error.hidden = false;
            }
            submitState.idle();
            return;
          }
          throw new Error(response.body.error || 'qualification_failed');
        }
        var qualification = response.body.qualification;
        track('partner_qualification_complete', { partner_type: qualification.partnerType, purpose: qualification.purpose, scope: qualification.scope, timeline: qualification.timeline, qualification_band: qualification.qualificationBand, recommended_action: qualification.recommendedAction });
        var touch = attribution();
        var qualifiedAttribution = { partner_type: qualification.partnerType, qualification_band: qualification.qualificationBand, recommended_action: qualification.recommendedAction, source_page: window.location.pathname, firstTouch: touch.firstTouch, lastTouch: touch.lastTouch, source: touch.source, medium: touch.medium, campaign: touch.campaign, insightSlug: touch.insightSlug, ctaId: touch.ctaId, ctaType: touch.ctaType, editorialIntent: touch.editorialIntent };
        recordConversion('PARTNER_QUALIFIED', qualifiedAttribution);
        persistConversion('PARTNER_QUALIFIED', { leadId: payload.leadId, partnerType: qualification.partnerType, qualificationBand: qualification.qualificationBand, sourcePage: window.location.pathname, firstTouch: touch.firstTouch, lastTouch: touch.lastTouch, source: touch.source, medium: touch.medium, campaign: touch.campaign, insightSlug: touch.insightSlug, ctaId: touch.ctaId, ctaType: touch.ctaType, editorialIntent: touch.editorialIntent });
        if (result) {
          if (qualification.recommendedAction === 'CONSULT') {
            result.innerHTML = 'ありがとうございます。現在の状況を踏まえてご相談いただけます。<a href="https://www.coaretail.com/readiness/mtgschedule" target="_blank" rel="noopener">無料相談を予約する</a>';
          } else {
            result.textContent = 'ありがとうございます。まずはResearch Hubの資料をご覧ください。';
          }
          result.hidden = false;
        }
        if (submitButton) submitButton.disabled = true;
        var cta = document.querySelector('.hero-cta');
        if (qualification.recommendedAction === 'CONSULT' && cta) { track('partner_consult_cta_impression'); cta.addEventListener('click', function () { var consultTouch = attribution(); track('partner_consult_cta_click'); recordConversion('CONSULT_CLICK', { source_page: window.location.pathname, firstTouch: consultTouch.firstTouch, lastTouch: consultTouch.lastTouch, source: consultTouch.source, medium: consultTouch.medium, campaign: consultTouch.campaign, insightSlug: consultTouch.insightSlug, ctaId: consultTouch.ctaId, ctaType: consultTouch.ctaType, editorialIntent: consultTouch.editorialIntent }); }); }
      })
      .catch(function () {
        if (error) { error.textContent = '送信を完了できませんでした。入力内容は保持されています。時間をおいて、もう一度お試しください。'; error.hidden = false; }
        submitState.idle();
      });
  });

  function persistConversion(type, params) { fetch('/api/conversion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ conversionType: type }, params || {})) }).catch(function () {}); }

  function recordConversion(type, params) {
    var key = type + ':' + (params && params.source_page || Date.now());
    var records = [];
    try { records = JSON.parse(window.localStorage.getItem('ari_conversion_log_v1') || '[]'); } catch (_) {}
    if (records.some(function (record) { return record.key === key; })) return;
    var safe = { key: key, conversionType: type, value: null, currency: 'JPY', occurredAt: new Date().toISOString(), schemaVersion: '1' };
    Object.keys(params || {}).forEach(function (field) { if (['email', 'company', 'domain', 'name', 'note'].indexOf(field) === -1) safe[field] = params[field]; });
    records.push(safe);
    try { window.localStorage.setItem('ari_conversion_log_v1', JSON.stringify(records.slice(-100))); } catch (_) {}
  }
})();
