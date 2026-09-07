/* Site-wide CTA analytics. Sends only canonical taxonomy and placement metadata. */
(function () {
  var ATTRIBUTION_KEY = 'ari_attribution_v1';
  function pageContext(link) {
    var sourcePage = link && link.getAttribute('data-source-page') || window.location.pathname || '/';
    var article = document.querySelector('article.article-body[data-article-slug]');
    var container = document.querySelector('.sitewide-cta[data-editorial-intent]');
    var slugMatch = sourcePage.match(/\/insights\/([^/]+)/);
    return {
      sourceSurface: slugMatch || sourcePage.indexOf('/insights/') === 0 ? 'insight' : sourcePage.indexOf('/report/') === 0 ? 'report' : sourcePage === '/' ? 'homepage' : 'other',
      insightSlug: (slugMatch && slugMatch[1]) || (article && article.getAttribute('data-article-slug')) || '',
      editorialIntent: (link && link.getAttribute('data-editorial-intent')) || (container && container.getAttribute('data-editorial-intent')) || (article && article.getAttribute('data-editorial-intent')) || '',
      sourcePage: sourcePage,
    };
  }
  function rememberTouch(link) {
    var query = new URLSearchParams(window.location.search);
    var context = pageContext(link);
    var touch = {
      source: (query.get('utm_source') || '').slice(0, 200), medium: (query.get('utm_medium') || '').slice(0, 200),
      campaign: (query.get('utm_campaign') || '').slice(0, 200), content: (query.get('utm_content') || '').slice(0, 200),
      term: (query.get('utm_term') || '').slice(0, 200), landingPage: (window.location.pathname || '/').slice(0, 500),
      referrer: (document.referrer || '').slice(0, 500), sourceSurface: context.sourceSurface, insightSlug: context.insightSlug,
      ctaId: link ? link.getAttribute('data-cta-id') || '' : '', ctaType: link ? link.getAttribute('data-cta-type') || '' : '', editorialIntent: context.editorialIntent, capturedAt: new Date().toISOString()
    };
    var saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY) || '{}'); } catch (_) {}
    if (!saved.firstTouch && Object.keys(touch).some(function (key) { return touch[key] && key !== 'capturedAt'; })) saved.firstTouch = touch;
    saved.lastTouch = touch;
    try { window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(saved)); } catch (_) {}
  }
  function track(name, link) {
    if (typeof window.gtag !== 'function') return;
    var context = pageContext(link);
    var query = new URLSearchParams(window.location.search);
    window.gtag('event', name, {
      cta_id: link.getAttribute('data-cta-id') || '',
      cta_type: link.getAttribute('data-cta-type') || '',
      placement: link.getAttribute('data-placement') || '',
      source_page: context.sourcePage,
      source_surface: context.sourceSurface,
      insight_slug: context.insightSlug,
      editorial_intent: context.editorialIntent,
      source: (query.get('utm_source') || '').slice(0, 200),
      medium: (query.get('utm_medium') || '').slice(0, 200),
      campaign: (query.get('utm_campaign') || '').slice(0, 200),
      landing_page: window.location.pathname || '/',
      transport_type: 'beacon',
    });
  }

  function bind(link) {
    if (link.getAttribute('data-cta-bound') === '1') return;
    link.setAttribute('data-cta-bound', '1');
    link.addEventListener('click', function () { rememberTouch(link); track('cta_click', link); });
  }

  var links = Array.prototype.slice.call(document.querySelectorAll('[data-funnel-cta]'));
  rememberTouch(null);
  links.forEach(bind);
  if (!links.length || typeof window.IntersectionObserver !== 'function') return;
  var seen = new WeakSet();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || seen.has(entry.target)) return;
      seen.add(entry.target);
      track('cta_impression', entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.2 });
  links.forEach(function (link) { observer.observe(link); });
})();
