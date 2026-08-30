(function () {
  'use strict';

  function resolveMaster(root) {
    var scenarioId = root && root.getAttribute('data-demo-scenario');
    if (scenarioId && window.AGENT_DEMO_SCENARIOS && window.AGENT_DEMO_SCENARIOS[scenarioId]) {
      return window.AGENT_DEMO_SCENARIOS[scenarioId];
    }
    return window.ARI_FV_MASTER;
  }

  function bootAll() {
    if (typeof window.gsap === 'undefined') {
      window.setTimeout(bootAll, 30);
      return;
    }
    var nodes = document.querySelectorAll('[data-agent-demo], #ari-fv-animation');
    for (var i = 0; i < nodes.length; i++) {
      initNode(nodes[i]);
    }
  }

  function initNode(root) {
    if (!root || root.__ariFvInitialized) return;

    var MASTER = resolveMaster(root);
    if (!MASTER) return;

    root.__ariFvInitialized = true;

    var gsap = window.gsap;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var paused = false;

    var flowEl;
    var threadEl;
    var threadWrapEl;
    var glassMotionEl;
    var masterTl;
    var glassTl;
    var thinkingTl;
    var currentIndustryId = null;
    var currentPhase = null;
    var thinkingEl = null;

    var DISCOVER_HINTS = {
      'personal-gym': ['初心者向け・体験あり', '月額プランあり', '駅徒歩4分'],
      dental: ['土曜診療あり', '初診対応', '駅徒歩3分'],
      'beauty-clinic': ['料金が明確', '無料相談あり', '当日カウンセリング可'],
      restaurant: ['個室あり', '接待対応', '落ち着いた雰囲気'],
      hotel: ['4名利用可', '駅徒歩4分', 'ファミリー向け']
    };

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
    }

    function buildFlowLabels() {
      if (!flowEl) return;
      flowEl.innerHTML = '';
      MASTER.flowLabels.forEach(function (item, idx) {
        if (idx > 0) {
          var arrow = document.createElement('span');
          arrow.className = 'ari-fv-flow__arrow';
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = '→';
          flowEl.appendChild(arrow);
        }
        var span = document.createElement('span');
        span.className = 'ari-fv-flow__item';
        span.dataset.phase = item.id;
        span.textContent = item.label;
        flowEl.appendChild(span);
      });
    }

    function setActiveFlow(phase) {
      if (!flowEl || phase === 'transition') return;
      flowEl.querySelectorAll('.ari-fv-flow__item').forEach(function (item) {
        item.classList.toggle('is-active', item.dataset.phase === phase);
      });
    }

    function buildDeviceShell() {
      root.innerHTML =
        '<div class="ari-fv-flow" role="presentation" aria-hidden="true"></div>' +
        '<div class="ari-fv-device" aria-hidden="true">' +
          '<div class="ari-fv-device__shadow" aria-hidden="true">' +
            '<div class="ari-fv-device__shadow-contact"></div>' +
            '<div class="ari-fv-device__shadow-ambient"></div>' +
          '</div>' +
          '<div class="ari-fv-device__body">' +
            '<div class="ari-fv-device__screen-slot">' +
              '<div class="ari-fv-chat">' +
                '<header class="ari-fv-chat__header">' +
                  '<span class="ari-fv-chat__title">AI Assistant</span>' +
                  '<span class="ari-fv-chat__status"><span class="ari-fv-chat__status-dot"></span>AI</span>' +
                '</header>' +
                '<div class="ari-fv-chat__thread-wrap">' +
                  '<div class="ari-fv-chat__thread"></div>' +
                '</div>' +
                '<div class="ari-fv-chat__composer" aria-hidden="true">' +
                  '<div class="ari-fv-chat__composer-field">AIに質問する</div>' +
                  '<div class="ari-fv-chat__composer-send">↑</div>' +
                '</div>' +
              '</div>' +
              '<div class="ari-fv-device__glass" aria-hidden="true">' +
                '<div class="ari-fv-device__glass-falloff"></div>' +
                '<div class="ari-fv-device__glass-reflection-dark"></div>' +
                '<div class="ari-fv-device__glass-edge-falloff"></div>' +
                '<div class="ari-fv-device__glass-reflection-primary"></div>' +
                '<div class="ari-fv-device__glass-reflection-secondary"></div>' +
                '<div class="ari-fv-device__glass-edge"></div>' +
              '</div>' +
            '</div>' +
            '<img class="ari-fv-device__frame-img" src="assets/device/mockup_iphone16-frame.webp" alt="" aria-hidden="true" width="393" height="800" decoding="async">' +
          '</div>' +
        '</div>';

      flowEl = root.querySelector('.ari-fv-flow');
      threadEl = root.querySelector('.ari-fv-chat__thread');
      threadWrapEl = root.querySelector('.ari-fv-chat__thread-wrap');
      glassMotionEl = root.querySelector('.ari-fv-device__glass');
    }

    function fixAssetPaths() {
      var frame = root.querySelector('.ari-fv-device__frame-img');
      if (!frame) return;
      var prefix = root.getAttribute('data-asset-prefix') || '';
      if (prefix) frame.src = prefix + 'assets/device/mockup_iphone16-frame.webp';
    }

    function scrollThread(duration) {
      if (!threadEl || !threadWrapEl) return;
      var overflow = threadEl.scrollHeight - threadWrapEl.clientHeight;
      if (overflow <= 0) return;
      gsap.to(threadEl, {
        y: -overflow,
        duration: duration == null ? 0.42 : duration,
        ease: 'power2.out'
      });
    }

    function animateMessageIn(el) {
      if (reducedMotion) {
        gsap.set(el, { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.fromTo(el, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.38, ease: 'power2.out' });
    }

    function stopThinking() {
      if (thinkingTl) {
        thinkingTl.kill();
        thinkingTl = null;
      }
      thinkingEl = null;
    }

    function startThinking(container) {
      stopThinking();
      var dots = container.querySelectorAll('.ari-fv-thinking span');
      if (!dots.length || reducedMotion) return;
      thinkingEl = container;
      thinkingTl = gsap.timeline({ repeat: -1 });
      dots.forEach(function (dot, i) {
        thinkingTl.to(dot, { opacity: 1, duration: 0.28, ease: 'sine.inOut' }, i * 0.18);
        thinkingTl.to(dot, { opacity: 0.25, duration: 0.28, ease: 'sine.inOut' }, i * 0.18 + 0.28);
      });
    }

    function appendUserMessage(text) {
      var el = document.createElement('div');
      el.className = 'ari-fv-msg ari-fv-msg--user';
      el.innerHTML = '<div class="ari-fv-msg__bubble">' + escapeHtml(text) + '</div>';
      threadEl.appendChild(el);
      animateMessageIn(el);
      scrollThread();
      return el;
    }

    function appendAiMessage(html, highlight) {
      var el = document.createElement('div');
      el.className = 'ari-fv-msg ari-fv-msg--ai' + (highlight ? ' ari-fv-msg--highlight' : '');
      el.innerHTML =
        '<div class="ari-fv-msg__avatar" aria-hidden="true"></div>' +
        '<div class="ari-fv-msg__body">' + html + '</div>';
      threadEl.appendChild(el);
      animateMessageIn(el);
      scrollThread();
      return el;
    }

    function renderSearchAi(text, sub) {
      return (
        '<p class="ari-fv-ai-text">' + escapeHtml(text || '条件に合う候補を探しています') + '</p>' +
        '<p class="ari-fv-ai-sub">' + escapeHtml(sub || '検索中…') + '</p>' +
        '<div class="ari-fv-thinking" aria-hidden="true"><span></span><span></span><span></span></div>'
      );
    }

    function renderDiscover(industry) {
      var hints = DISCOVER_HINTS[industry.id] || [];
      var items = industry.candidates.map(function (name, i) {
        return (
          '<div class="ari-fv-result">' +
            '<span class="ari-fv-result__dot" aria-hidden="true">●</span>' +
            '<div class="ari-fv-result__text">' +
              '<strong>' + escapeHtml(name) + '</strong>' +
              '<span>' + escapeHtml(hints[i] || '公式情報を確認') + '</span>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      return '<p class="ari-fv-ai-text">条件に合う3件を見つけました。</p><div class="ari-fv-results">' + items + '</div>';
    }

    function renderUnderstand(industry) {
      var rows = industry.understand.map(function (row) {
        return (
          '<div class="ari-fv-struct__row">' +
            '<span>' + escapeHtml(row.key) + '</span>' +
            '<strong>' + escapeHtml(row.value) + '</strong>' +
          '</div>'
        );
      }).join('');
      return (
        '<p class="ari-fv-ai-text">公式情報から条件を整理しました。</p>' +
        '<div class="ari-fv-struct">' + rows + '</div>'
      );
    }

    function renderCompare(industry) {
      var cmp = industry.compare;
      var head =
        '<div class="ari-fv-compare-lite__row ari-fv-compare-lite__row--head">' +
        '<span></span>' +
        cmp.headers.map(function (h) { return '<span>' + escapeHtml(h) + '</span>'; }).join('') +
        '</div>';
      var body = cmp.rows.map(function (row) {
        return (
          '<div class="ari-fv-compare-lite__row">' +
          '<span>' + escapeHtml(row.label) + '</span>' +
          row.values.map(function (v) { return '<span>' + escapeHtml(v) + '</span>'; }).join('') +
          '</div>'
        );
      }).join('');
      return (
        '<p class="ari-fv-ai-text">条件に合わせて比較します。</p>' +
        '<div class="ari-fv-compare-lite">' + head + body + '</div>'
      );
    }

    function renderRecommend(industry) {
      var rec = industry.recommend;
      var reasons = rec.reasons.map(function (r) {
        return '<div class="ari-fv-rec__reason">✓ ' + escapeHtml(r) + '</div>';
      }).join('');
      return (
        '<p class="ari-fv-ai-text">あなたの条件なら、<strong>' + escapeHtml(rec.name) + '</strong> が最も合っています。</p>' +
        '<div class="ari-fv-rec">' +
          '<div class="ari-fv-rec__name">' + escapeHtml(rec.name) + '</div>' +
          reasons +
          '<div class="ari-fv-rec__badge">おすすめ：' + escapeHtml(rec.name) + '</div>' +
        '</div>'
      );
    }

    function clearThread(animate) {
      stopThinking();
      if (!threadEl) return;
      if (animate && !reducedMotion) {
        gsap.to(threadEl, {
          autoAlpha: 0,
          y: -8,
          duration: 0.32,
          ease: 'power2.in',
          onComplete: function () {
            threadEl.innerHTML = '';
            gsap.set(threadEl, { autoAlpha: 1, y: 0 });
          }
        });
      } else {
        threadEl.innerHTML = '';
        gsap.set(threadEl, { y: 0, autoAlpha: 1 });
      }
    }

    function beginIndustry(industry) {
      currentIndustryId = industry.id;
      currentPhase = null;
      clearThread(false);
      appendUserMessage(industry.query);
    }

    function beginScenario(scenario) {
      currentIndustryId = scenario.id;
      currentPhase = null;
      clearThread(false);
      appendUserMessage(scenario.query);
    }

    function runPhase(industry, phase) {
      if (currentPhase === phase && currentIndustryId === industry.id) return;
      currentPhase = phase;
      setActiveFlow(phase);
      stopThinking();

      if (phase === 'search') {
        var searchMsg = appendAiMessage(renderSearchAi());
        startThinking(searchMsg);
        return;
      }

      if (phase === 'discover') appendAiMessage(renderDiscover(industry));
      else if (phase === 'understand') appendAiMessage(renderUnderstand(industry));
      else if (phase === 'compare') appendAiMessage(renderCompare(industry));
      else if (phase === 'recommend') appendAiMessage(renderRecommend(industry), true);
    }

    function runStep(scenario, step) {
      if (currentPhase === step.phase && currentIndustryId === scenario.id) return;
      currentPhase = step.phase;
      setActiveFlow(step.phase);
      stopThinking();

      if (step.render === 'thinking') {
        var thinkingMsg = appendAiMessage(renderSearchAi(step.text, step.sub));
        startThinking(thinkingMsg);
        return;
      }

      if (step.render === 'html') appendAiMessage(step.html, step.highlight);
    }

    function endIndustry() {
      stopThinking();
      if (!reducedMotion && threadEl) {
        gsap.to(threadEl, { autoAlpha: 0.55, duration: 0.28, ease: 'power1.inOut' });
      }
    }

    function buildIndustryTimeline() {
      masterTl = gsap.timeline({ repeat: -1, paused: true });
      MASTER.industries.forEach(function (industry) {
        var base = industry.start;
        masterTl.call(function () { beginIndustry(industry); }, null, base);
        masterTl.call(function () { runPhase(industry, 'search'); }, null, base);
        masterTl.call(function () { runPhase(industry, 'discover'); }, null, base + 2);
        masterTl.call(function () { runPhase(industry, 'understand'); }, null, base + 4);
        masterTl.call(function () { runPhase(industry, 'compare'); }, null, base + 6);
        masterTl.call(function () { runPhase(industry, 'recommend'); }, null, base + 8);
        masterTl.call(function () { endIndustry(); }, null, base + 9.6);
      });
    }

    function buildStepsTimeline() {
      var loop = MASTER.loop !== false;
      masterTl = gsap.timeline({ repeat: loop ? -1 : 0, paused: true });
      masterTl.call(function () { beginScenario(MASTER); }, null, 0);
      MASTER.steps.forEach(function (step) {
        masterTl.call(function () { runStep(MASTER, step); }, null, step.at);
      });
      masterTl.call(function () { endIndustry(); }, null, MASTER.duration - 0.4);
    }

    function buildMasterTimeline() {
      if (MASTER.industries) buildIndustryTimeline();
      else if (MASTER.steps) buildStepsTimeline();
    }

    function startGlassReflection() {
      if (!glassMotionEl || reducedMotion) return;
      glassTl = gsap.timeline({ repeat: -1, repeatDelay: 18 });
      glassTl.fromTo(
        glassMotionEl,
        { x: 0, y: 0, opacity: 0.92 },
        { x: 2, y: 1, opacity: 1, duration: 9, ease: 'sine.inOut' }
      );
      glassTl.to(
        glassMotionEl,
        { x: 0, y: 0, opacity: 0.94, duration: 9, ease: 'sine.inOut' }
      );
    }

    function showStaticRecommend() {
      if (MASTER.industries) {
        var industry = MASTER.industries[0];
        clearThread(false);
        appendUserMessage(industry.query);
        appendAiMessage(renderRecommend(industry), true);
        setActiveFlow('recommend');
        return;
      }
      if (MASTER.steps) {
        clearThread(false);
        appendUserMessage(MASTER.query);
        var finalStep = MASTER.steps.filter(function (s) { return s.highlight; }).pop()
          || MASTER.steps[MASTER.steps.length - 1];
        if (finalStep) {
          runStep(MASTER, finalStep);
        }
        setActiveFlow(MASTER.staticFinalPhase || finalStep.phase);
      }
    }

    function start() {
      if (reducedMotion || paused || !masterTl) return;
      masterTl.play(0);
      if (glassTl) glassTl.play();
    }

    function stop() {
      if (masterTl) masterTl.pause();
      if (glassTl) glassTl.pause();
      stopThinking();
    }

    function destroy() {
      stop();
      if (masterTl) { masterTl.kill(); masterTl = null; }
      if (glassTl) { glassTl.kill(); glassTl = null; }
      root.__ariFvInitialized = false;
    }

    function init() {
      buildDeviceShell();
      fixAssetPaths();
      buildFlowLabels();
      buildMasterTimeline();
      startGlassReflection();

      if (reducedMotion) {
        showStaticRecommend();
        return;
      }

      start();

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          paused = true;
          stop();
        } else {
          paused = false;
          start();
        }
      });

      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
        reducedMotion = e.matches;
        if (reducedMotion) {
          stop();
          if (masterTl) masterTl.kill();
          if (glassTl) glassTl.kill();
          showStaticRecommend();
        }
      });
    }

    init();

    root.__ariFvDestroy = destroy;
    root.__ariFvStop = stop;
    root.__ariFvStart = start;
  }

  window.reinitAgentDemo = function (root, scenarioId) {
    if (!root) return;
    if (root.__ariFvDestroy) root.__ariFvDestroy();
    if (scenarioId) root.setAttribute('data-demo-scenario', scenarioId);
    initNode(root);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }
})();
