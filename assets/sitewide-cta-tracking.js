/* Site-wide CTA analytics. Sends only canonical taxonomy and placement metadata. */
(function () {
  function track(name, link) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, {
      cta_id: link.getAttribute('data-cta-id') || '',
      cta_type: link.getAttribute('data-cta-type') || '',
      placement: link.getAttribute('data-placement') || '',
      source_page: link.getAttribute('data-source-page') || window.location.pathname || '/',
      transport_type: 'beacon',
    });
  }

  function bind(link) {
    if (link.getAttribute('data-cta-bound') === '1') return;
    link.setAttribute('data-cta-bound', '1');
    link.addEventListener('click', function () { track('cta_click', link); });
  }

  var links = Array.prototype.slice.call(document.querySelectorAll('[data-funnel-cta]'));
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
