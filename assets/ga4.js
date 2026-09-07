/**
 * Google Analytics 4 — readiness.coaretail.com
 * Measurement ID: G-BS30YQY1N7
 */
(function (w, d, id) {
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () {
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id);
  function trackLandingView() {
    var pathname = w.location.pathname || '/';
    var article = d.querySelector('article.article-body[data-article-slug]');
    var sourceSurface = pathname.indexOf('/insights/') === 0 ? 'insight' : pathname.indexOf('/report/') === 0 ? 'report' : pathname === '/' ? 'homepage' : 'other';
    w.gtag('event', 'landing_view', {
      source_surface: sourceSurface,
      landing_page: pathname,
      insight_slug: article ? article.getAttribute('data-article-slug') || '' : '',
      editorial_intent: article ? article.getAttribute('data-editorial-intent') || '' : '',
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', trackLandingView);
  else trackLandingView();
  var first = d.getElementsByTagName('script')[0];
  var tag = d.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  first.parentNode.insertBefore(tag, first);
})(window, document, 'G-BS30YQY1N7');
