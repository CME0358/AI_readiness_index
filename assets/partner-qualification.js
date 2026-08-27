/* Verified Company Report customers only. Qualification never controls report access. */
(function () {
  var section = document.querySelector('[data-partner-qualification]');
  var form = document.querySelector('[data-partner-qualification-form]');
  if (!section || !form) return;
  var result = section.querySelector('[data-partner-qualification-result]');
  var error = section.querySelector('[data-partner-qualification-error]');
  var purchase;
  try { purchase = JSON.parse(window.localStorage.getItem('ari_purchase_state') || 'null'); } catch (_) { purchase = null; }
  var eligibleIds = ['company_report_bundle', 'company_report_legacy'];
  if (!purchase || purchase.verified !== true || !purchase.entitlements || purchase.entitlements.companyReport !== true || eligibleIds.indexOf(purchase.productId) === -1) return;
  if (purchase.expiresAt && Date.now() > purchase.expiresAt) return;
  section.classList.add('is-eligible');
  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    var safe = { source: 'company_report', schema_version: '1' };
    Object.keys(params || {}).forEach(function (key) { if (['email', 'company', 'domain', 'name', 'note'].indexOf(key) === -1) safe[key] = params[key]; });
    window.gtag('event', name, safe);
  }
  track('partner_qualification_view');
  var started = false;
  form.addEventListener('focusin', function () { if (!started) { started = true; track('partner_qualification_start'); } });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var payload = { sessionId: purchase.sessionId, leadId: '', leadRecordId: '', purpose: data.get('purpose'), scope: data.get('scope'), timeline: data.get('timeline'), note: data.get('note') };
    try { payload.leadId = window.localStorage.getItem('ari_lead_id') || ''; } catch (_) {}
    try { payload.leadRecordId = window.localStorage.getItem('ari_lead_record_id') || ''; } catch (_) {}
    if (!payload.purpose || !payload.scope || !payload.timeline) { error.textContent = '利用目的・導入対象・検討時期を選択してください。'; error.hidden = false; return; }
    var button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    error.hidden = true;
    fetch('/api/partner-qualification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
      .then(function (response) {
        if (!response.ok) throw new Error(response.body.error || 'qualification_failed');
        var qualification = response.body.qualification;
        track('partner_qualification_complete', { partner_type: qualification.partnerType, purpose: qualification.purpose, scope: qualification.scope, timeline: qualification.timeline, qualification_band: qualification.qualificationBand, recommended_action: qualification.recommendedAction });
        recordConversion('PARTNER_QUALIFIED', { partner_type: qualification.partnerType, qualification_band: qualification.qualificationBand, recommended_action: qualification.recommendedAction, source_page: window.location.pathname });
        persistConversion('PARTNER_QUALIFIED', { leadId: payload.leadId, partnerType: qualification.partnerType, qualificationBand: qualification.qualificationBand, sourcePage: window.location.pathname });
        if (result) { result.textContent = qualification.recommendedAction === 'CONSULT' ? 'ありがとうございます。現在の状況を踏まえてご相談いただけます。' : 'ありがとうございます。まずはResearch Hubの資料をご覧ください。'; result.hidden = false; }
        if (button) button.disabled = true;
        var cta = document.querySelector('.hero-cta');
        if (qualification.recommendedAction === 'CONSULT' && cta) { track('partner_consult_cta_impression'); cta.addEventListener('click', function () { track('partner_consult_cta_click'); recordConversion('CONSULT_CLICK', { source_page: window.location.pathname }); }); }
      })
      .catch(function () { if (error) { error.textContent = '送信を完了できませんでした。時間をおいて、もう一度お試しください。'; error.hidden = false; } if (button) button.disabled = false; });
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
