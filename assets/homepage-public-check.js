/* Homepage public Check. Analytics: no company, URL, domain, email, or phone. */
(function () {
  var section = document.getElementById('company-check');
  if (!section) return;

  var form = section.querySelector('[data-public-check-form]');
  var input = section.querySelector('[data-public-check-input]');
  var submit = section.querySelector('[data-public-check-submit]');
  var statusEl = section.querySelector('[data-public-check-status]');
  var resultEl = section.querySelector('[data-public-check-result]');
  var errorEl = section.querySelector('[data-public-check-error]');
  var hostEl = section.querySelector('[data-public-check-host]');
  var findingsEl = section.querySelector('[data-public-check-findings]');
  var PII = ['email', 'company', 'phone', 'url', 'domain', 'host'];

  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    var safe = { transport_type: 'beacon', schema_version: '1' };
    Object.keys(params || {}).forEach(function (key) {
      if (PII.indexOf(key) === -1) safe[key] = params[key];
    });
    window.gtag('event', name, safe);
  }

  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function setBusy(busy) {
    if (submit) submit.disabled = busy;
    if (input) input.disabled = busy;
    if (statusEl) statusEl.textContent = busy ? '公開ページを確認しています…' : '';
  }

  function renderFindings(findings) {
    findingsEl.innerHTML = '';
    (findings || []).slice(0, 2).forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item.copy || '';
      findingsEl.appendChild(li);
    });
  }

  function categoryFrom(findings) {
    if (!findings || !findings.length) return 'empty';
    return findings.length === 1 ? 'single' : 'pair';
  }

  if (typeof window.IntersectionObserver === 'function') {
    var seen = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen) return;
        seen = true;
        track('check_impression', { cta_id: 'homepage_check_section', cta_type: 'CHECK', page: '/', source_surface: 'homepage', landing_page: '/' });
        observer.disconnect();
      });
    }, { threshold: 0.2 });
    observer.observe(section);
  }

  if (!form) return;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    show(errorEl, false);
    show(resultEl, false);
    var value = (input && input.value || '').trim();
    track('check_start', { cta_id: 'homepage_check_submit', cta_type: 'CHECK', page: '/', source_surface: 'homepage', landing_page: '/' });
    if (!value) {
      errorEl.textContent = '公式サイトのURLを入力してください。';
      show(errorEl, true);
      track('check_result', { cta_id: 'homepage_check_submit', cta_type: 'CHECK', status: 'invalid', result_category: 'invalid', source_surface: 'homepage', landing_page: '/' });
      return;
    }
    setBusy(true);
    fetch('/api/public-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: value }),
    }).then(function (res) {
      return res.json().then(function (body) {
        return { okHttp: res.ok, body: body };
      });
    }).then(function (payload) {
      var body = payload.body || {};
      if (!body.ok) {
        var messages = {
          invalid_url: '入力されたURLを確認できませんでした。公開されているhttpsの公式サイトを指定してください。',
          timeout: '応答が時間内に返りませんでした。時間をおいて再試行するか、無料ガイドをご覧ください。',
          non_html: 'HTMLの公開ページとして確認できませんでした。',
          blocked_target: 'この宛先は確認対象にできません。',
          unreachable: '公開ページに到達できませんでした。再試行するか、無料ガイドをご覧ください。',
        };
        errorEl.textContent = messages[body.error] || messages.unreachable;
        show(errorEl, true);
        track('check_result', { cta_id: 'homepage_check_submit', cta_type: 'CHECK', status: 'error', result_category: body.error || 'unreachable', source_surface: 'homepage', landing_page: '/' });
        return;
      }
      if (hostEl) hostEl.textContent = body.host || '';
      renderFindings(body.findings);
      show(resultEl, true);
      track('check_result', {
        cta_id: 'homepage_check_submit',
        cta_type: 'CHECK',
        status: 'ok',
        result_category: categoryFrom(body.findings),
        source_surface: 'homepage',
        landing_page: '/',
      });
    }).catch(function () {
      errorEl.textContent = '確認を完了できませんでした。再試行するか、無料ガイドをご覧ください。';
      show(errorEl, true);
      track('check_result', { cta_id: 'homepage_check_submit', cta_type: 'CHECK', status: 'error', result_category: 'unreachable', source_surface: 'homepage', landing_page: '/' });
    }).finally(function () {
      setBusy(false);
    });
  });
})();
