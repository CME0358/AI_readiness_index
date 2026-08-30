/**
 * OISUMMIT lead forms — /api/oisummit-lead
 */
(function () {
  'use strict';

  var ATTRIBUTION_KEY = 'ari_attribution_v1';

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
      capturedAt: new Date().toISOString(),
    };
    var saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY) || '{}'); } catch (_) {}
    return { firstTouch: saved.firstTouch || current, lastTouch: saved.lastTouch || current };
  }

  function track(name, params) {
    if (typeof window.oisummitTrack === 'function') window.oisummitTrack(name, params);
  }

  document.querySelectorAll('[data-oisummit-lead-form]').forEach(function (form) {
    var segment = form.getAttribute('data-segment') || '';
    var success = form.parentElement.querySelector('[data-oisummit-lead-success]');
    var error = form.parentElement.querySelector('[data-oisummit-lead-error]');
    var started = false;

    form.addEventListener('focusin', function () {
      if (!started) {
        started = true;
        track('oisummit_form_start', { segment: segment, cta_type: 'form' });
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var submit = form.querySelector('button[type="submit"]');
      if (submit && submit.disabled) return;
      if (submit) submit.disabled = true;
      if (error) error.hidden = true;

      var data = new FormData(form);
      var touches = attribution();
      var payload = {
        segment: segment,
        company: data.get('company'),
        name: data.get('name'),
        department: data.get('department'),
        email: data.get('email'),
        interest: data.get('interest'),
        message: data.get('message'),
        orgType: data.get('orgType'),
        consent: data.get('consent') === 'on',
        website: data.get('website'),
        ctaId: 'oisummit_' + segment + '_form',
        landingPage: window.location.pathname,
        referrer: document.referrer,
        query: window.location.search,
        source: touches.lastTouch.source,
        medium: touches.lastTouch.medium,
        campaign: touches.lastTouch.campaign,
        content: touches.lastTouch.content,
        firstTouch: touches.firstTouch,
        lastTouch: touches.lastTouch,
      };

      fetch('/api/oisummit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.body.error || 'submit_failed');
          form.hidden = true;
          if (success) success.hidden = false;
          track('oisummit_lead_submit', { segment: segment, cta_type: 'form' });
          if (result.body.leadId) {
            try { window.localStorage.setItem('ari_lead_id', result.body.leadId); } catch (_) {}
          }
          if (result.body.storageRecordId) {
            try { window.localStorage.setItem('ari_lead_record_id', result.body.storageRecordId); } catch (_) {}
          }
          fetch('/api/conversion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversionType: 'LEAD_CREATED',
              leadId: result.body.leadId,
              segment: result.body.segment,
              sourcePage: window.location.pathname,
              ctaId: 'oisummit_' + segment + '_form',
              ctaType: 'CONSULT',
            }),
          }).catch(function () {});
        })
        .catch(function () {
          if (error) {
            error.textContent = '送信を完了できませんでした。時間をおいて、もう一度お試しください。';
            error.hidden = false;
          }
          if (submit) submit.disabled = false;
        });
    });
  });
})();
