(function () {
  if (window.__ariHubAnimations) return;
  window.__ariHubAnimations = true;

  var GRID_SELECTORS = [
    '.hub-grid', '.dra-grid', '.layer-grid', '.link-grid', '.report-library-grid',
    '.card-grid', '.card-grid-3', '.card-grid-4', '.pillars', '.points', '.stats',
    '.research-grid', '.nav-cards', '.pub-grid', '.shift-grid', '.process-list',
    '.compare-grid', '.card-grid-3', '.principles-grid', '.tldr-grid'
  ];

  var BLOCK_SELECTORS = [
    '.body-text', '.lead', '.disclaimer', '.dra-total', '.dra-flow', '.funnel', '.funnel-row',
    '.insight-box', '.cta-row', '.disclaimer-box', '.score-section', '.table-wrap',
    '.dialog-box', '.tiktok-wrap', '.filter', '.glass', '.price-card', '.final-cta-inner',
    '.definition-block', '.tldr-box', '.table-note', '.tiktok-note', '.note', '.score-bar-wrap',
    '.score-improve-row', '.section-graphic', '.ai-chat-mock', '.score-visual-wrap'
  ];

  var CARD_SELECTORS = [
    '.hub-card', '.dra-card', '.layer-card', '.link-card', '.report-card'
  ];

  var observer;

  function markReveal(el) {
    if (!el || el.classList.contains('reveal') || el.classList.contains('hero-anim')) return;
    el.classList.add('reveal');
  }

  function autoApply() {
    document.querySelectorAll(
      '.page-hero .container, .hub-hero .container, .hero .container, .thanks-hero .container'
    ).forEach(function (container) {
      Array.prototype.forEach.call(container.children, function (el, i) {
        if (el.classList.contains('hero-anim') || el.hasAttribute('data-ari-no-animate')) return;
        el.classList.add('hero-anim', 'd' + Math.min(i + 1, 7));
      });
    });

    document.querySelectorAll('main section, body > section').forEach(function (section) {
      if (section.classList.contains('hub-hero') || section.classList.contains('nav')) return;
      var container = section.querySelector(':scope > .container, :scope > .final-cta-inner');
      if (!container) return;

      container.querySelectorAll(':scope > h2, :scope > .section-label').forEach(markReveal);
      container.querySelectorAll('.section-header').forEach(markReveal);

      GRID_SELECTORS.forEach(function (sel) {
        container.querySelectorAll(sel).forEach(function (grid) {
          if (!grid.classList.contains('anim-group')) grid.classList.add('anim-group');
          markReveal(grid);
          Array.prototype.forEach.call(grid.children, function (child) {
            if (!child.classList.contains('anim-item')) child.classList.add('anim-item');
          });
        });
      });

      BLOCK_SELECTORS.forEach(function (sel) {
        container.querySelectorAll(sel).forEach(markReveal);
      });

      CARD_SELECTORS.forEach(function (sel) {
        container.querySelectorAll(sel).forEach(function (el) {
          if (!el.closest('.anim-group')) markReveal(el);
        });
      });
    });

    document.querySelectorAll('.page.std-page, .page.cover-page').forEach(function (el, i) {
      markReveal(el);
      el.style.transitionDelay = (i % 6) * 0.04 + 's';
    });
  }

  function observeAll() {
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('visible');
          var id = e.target.id;
          if (id && window.__ariSectionAnimators && window.__ariSectionAnimators[id]) {
            window.__ariSectionAnimators[id](e.target);
          }
          observer.unobserve(e.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    }

    document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-scale, .anim-group, .flow-connector'
    ).forEach(function (el) {
      if (el.dataset.ariObserved) return;
      el.dataset.ariObserved = '1';
      observer.observe(el);
    });

    ['#score-visual', '#gap-diagram', '#ai-chat', '#score-improve', '#score-bar-wrap', '#flow-timeline', '#price-card'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el && !el.dataset.ariObserved) {
        el.dataset.ariObserved = '1';
        observer.observe(el);
      }
    });
  }

  function init() {
    autoApply();
    observeAll();
  }

  window.ariRefreshAnimations = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
