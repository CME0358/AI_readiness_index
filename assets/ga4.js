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
  var first = d.getElementsByTagName('script')[0];
  var tag = d.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  first.parentNode.insertBefore(tag, first);
})(window, document, 'G-BS30YQY1N7');
