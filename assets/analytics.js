/**
 * TMVU-04 — GA4 custom event helpers (Insights CTA + shared trackGaEvent).
 * Requires /assets/ga4.js loaded first (single gtag config).
 */
(function (w) {
  function trackGaEvent(name, params) {
    if (typeof w.gtag !== 'function') return;
    w.gtag(
      'event',
      name,
      Object.assign({ transport_type: 'beacon' }, params || {}),
    );
  }

  var CTA_EVENT_MAP = {
    '/framework/': { event: 'insight_cta_framework', cta_type: 'framework' },
    '/research/': { event: 'insight_cta_research', cta_type: 'research' },
    '/report/': { event: 'insight_cta_report', cta_type: 'report' },
  };

  function initInsightCtaTracking() {
    var article = document.querySelector('article.article-body[data-article-slug]');
    if (!article) return;

    var slug = article.getAttribute('data-article-slug');
    if (!slug) return;

    var title = article.getAttribute('data-article-title') || '';
    var pagePath = w.location.pathname || '/';
    var ctaSection = article.querySelector('.article-cta');
    if (!ctaSection) return;

    ctaSection.querySelectorAll('a[href][data-ga-insight-cta]').forEach(function (link) {
      if (link.getAttribute('data-ga-insight-bound') === '1') return;

      var href = link.getAttribute('href');
      var cfg = CTA_EVENT_MAP[href];
      if (!cfg) return;

      link.setAttribute('data-ga-insight-bound', '1');
      link.addEventListener('click', function () {
        trackGaEvent(cfg.event, {
          article_slug: slug,
          article_title: title,
          destination: href,
          cta_type: cfg.cta_type,
          page_path: pagePath,
        });
      });
    });
  }

  w.trackGaEvent = trackGaEvent;
  w.initInsightCtaTracking = initInsightCtaTracking;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInsightCtaTracking);
  } else {
    initInsightCtaTracking();
  }
})(window);
