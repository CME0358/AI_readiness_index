/**
 * OISUMMIT router — segment tab switching + meeting CTA fail-closed
 */
(function () {
  'use strict';

  function meetingUrl() {
    var cfg = window.OISUMMIT_CONFIG || {};
    var url = String(cfg.meetingUrl || '').trim();
    return url;
  }

  function applyMeetingLinks() {
    var url = meetingUrl();
    document.querySelectorAll('[data-oisummit-meeting]').forEach(function (link) {
      if (!url) {
        link.hidden = true;
        link.setAttribute('aria-hidden', 'true');
        return;
      }
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.hidden = false;
      link.removeAttribute('aria-hidden');
    });
    document.querySelectorAll('[data-oisummit-meeting-fallback]').forEach(function (el) {
      el.hidden = Boolean(url);
    });
  }

  function initRouter() {
    var demo = document.querySelector('[data-oisummit-showcase-demo]');
    var tabs = document.querySelectorAll('[data-oisummit-segment-tab]');
    if (!demo || !tabs.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var scenario = tab.getAttribute('data-segment');
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (typeof window.reinitAgentDemo === 'function') {
          window.reinitAgentDemo(demo, scenario);
        }
      });
    });
  }

  applyMeetingLinks();
  initRouter();
})();
