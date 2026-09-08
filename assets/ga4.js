/**
 * Google Analytics 4 — readiness.coaretail.com
 * Measurement ID: G-BS30YQY1N7
 * ARI-P0-03: service_view, test traffic separation, measurement bridge for canonical aliases.
 */
(function (w, d, id) {
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () {
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());

  function isTestTraffic() {
    var host = (w.location && w.location.hostname) || '';
    if (!host || host === 'localhost' || host === '127.0.0.1') return true;
    if (host.indexOf('.vercel.app') !== -1 || host.indexOf('preview') !== -1) return true;
    try {
      if (new URLSearchParams(w.location.search).get('ari_debug') === '1') return true;
    } catch (_) { /* noop */ }
    return false;
  }

  function measurementContext() {
    if (!isTestTraffic()) return {};
    return { debug_mode: true, traffic_type: 'internal', measurement_schema: 'p0-03' };
  }

  var testTraffic = isTestTraffic();
  w.gtag('config', id, testTraffic ? { debug_mode: true, traffic_type: 'internal' } : {});

  function serviceViewForPath(pathname) {
    if (pathname.indexOf('/report/') === 0) return { service_kind: 'company_report', service_id: 'report' };
    if (pathname === '/improve.html') return { service_kind: 'local_improve', service_id: 'improve' };
    if (pathname.indexOf('/research/') === 0) return { service_kind: 'research_hub', service_id: 'research' };
    if (pathname.indexOf('/whitepaper/') === 0) return { service_kind: 'whitepaper', service_id: 'whitepaper' };
    if (pathname.indexOf('/framework/') === 0) return { service_kind: 'framework', service_id: 'framework' };
    if (pathname.indexOf('/oisummit/') === 0) return { service_kind: 'oisummit', service_id: 'oisummit' };
    if (pathname.indexOf('/services/') === 0) return { service_kind: 'services_hub', service_id: 'services' };
    if (pathname.indexOf('/guides/') === 0) return { service_kind: 'purchase_guide', service_id: 'guides' };
    if (pathname.indexOf('/cases/') === 0) return { service_kind: 'case_study', service_id: 'cases' };
    if (pathname.indexOf('/sample/') === 0) return { service_kind: 'report_sample', service_id: 'sample' };
    return null;
  }

  function trackLandingView() {
    var pathname = w.location.pathname || '/';
    var article = d.querySelector('article.article-body[data-article-slug]');
    var sourceSurface = pathname.indexOf('/insights/') === 0 ? 'insight' : pathname.indexOf('/report/') === 0 ? 'report' : pathname === '/' ? 'homepage' : 'other';
    w.gtag('event', 'landing_view', Object.assign({
      source_surface: sourceSurface,
      landing_page: pathname,
      insight_slug: article ? article.getAttribute('data-article-slug') || '' : '',
      editorial_intent: article ? article.getAttribute('data-editorial-intent') || '' : '',
      measurement_schema: 'p0-03',
    }, measurementContext()));
  }

  function trackServiceView() {
    var pathname = w.location.pathname || '/';
    var service = serviceViewForPath(pathname);
    if (!service) return;
    w.gtag('event', 'service_view', Object.assign({
      landing_page: pathname,
      service_kind: service.service_kind,
      service_id: service.service_id,
      measurement_schema: 'p0-03',
    }, measurementContext()));
  }

  function sanitize(params) {
    var safe = {};
    Object.keys(params || {}).forEach(function (key) {
      if (['email', 'company', 'domain', 'url', 'name', 'note'].indexOf(key) === -1 && params[key] !== undefined && params[key] !== null) {
        safe[key] = params[key];
      }
    });
    return safe;
  }

  var aliasMap = {
    report_start: 'diagnosis_start',
    report_result_view: 'diagnosis_complete',
    lead_created: 'lead_submit_success',
    purchase_verified: 'purchase',
  };

  w.ariMeasurement = {
    isTestTraffic: isTestTraffic,
    measurementContext: measurementContext,
    once: function (storage, key) {
      if (!key || !storage) return true;
      try {
        if (storage.getItem(key) === '1') return false;
        storage.setItem(key, '1');
        return true;
      } catch (_) { return true; }
    },
    emitWithAlias: function (primaryEvent, params) {
      if (typeof w.gtag !== 'function') return;
      var safe = Object.assign({ measurement_schema: 'p0-03' }, measurementContext(), sanitize(params || {}));
      w.gtag('event', primaryEvent, safe);
      var alias = aliasMap[primaryEvent];
      if (!alias) return;
      if (primaryEvent === 'purchase_verified' && params && params.verified !== true) return;
      w.gtag('event', alias, Object.assign({}, safe, { canonical_source_event: primaryEvent }));
    },
  };

  function boot() {
    trackLandingView();
    trackServiceView();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();

  var first = d.getElementsByTagName('script')[0];
  var tag = d.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  first.parentNode.insertBefore(tag, first);
})(window, document, 'G-BS30YQY1N7');
