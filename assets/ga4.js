/**
 * Google Analytics 4 — readiness.coaretail.com
 *
 * Measurement IDs:
 * - G-BS30YQY1N7 (Coa Retail corporate)
 * - G-R3QVBJZ53S (Agent Readiness stream / 15219144882)
 */
(function (w, d) {
  var ids = ['G-BS30YQY1N7', 'G-R3QVBJZ53S'];
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () {
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  ids.forEach(function (id) {
    w.gtag('config', id);
  });
  var first = d.getElementsByTagName('script')[0];
  var tag = d.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + ids[0];
  first.parentNode.insertBefore(tag, first);
})(window, document);
