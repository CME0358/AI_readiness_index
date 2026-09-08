/* Shared form UX: draft restore, field errors, submit busy state. No PII in storage keys. */
(function (global) {
  var STYLE_ID = 'ari-form-ux-styles';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.ari-field-error{margin:4px 0 0;font-size:13px;color:#b42318;line-height:1.4}',
      '.ari-field-error[hidden]{display:none!important}',
      '.ari-form-invalid{border-color:#b42318!important}',
      '.company-check-actions{margin-top:12px;display:flex;flex-wrap:wrap;gap:12px}',
    ].join('');
    document.head.appendChild(style);
  }

  function fieldControl(form, name) {
    if (!form || !name) return null;
    return form.querySelector('[name="' + name + '"]');
  }

  function ensureFieldErrorEl(input) {
    if (!input || !input.name) return null;
    var id = 'ari-field-error-' + input.name;
    var el = document.getElementById(id);
    if (!el) {
      ensureStyles();
      el = document.createElement('p');
      el.id = id;
      el.className = 'ari-field-error';
      el.hidden = true;
      el.setAttribute('role', 'alert');
      var parent = input.closest('label') || input.parentNode;
      if (parent) parent.appendChild(el);
      var described = input.getAttribute('aria-describedby') || '';
      if (described.indexOf(id) === -1) {
        input.setAttribute('aria-describedby', described ? described + ' ' + id : id);
      }
    }
    return el;
  }

  function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll('.ari-field-error').forEach(function (el) {
      el.hidden = true;
      el.textContent = '';
    });
    form.querySelectorAll('.ari-form-invalid').forEach(function (el) {
      el.classList.remove('ari-form-invalid');
      el.removeAttribute('aria-invalid');
    });
  }

  function setFieldError(form, name, message) {
    var input = fieldControl(form, name);
    if (!input || !message) return;
    var el = ensureFieldErrorEl(input);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    input.classList.add('ari-form-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  function mapServerFields(form, fields, messageMap) {
    clearFieldErrors(form);
    var mapped = false;
    Object.keys(fields || {}).forEach(function (key) {
      var code = fields[key];
      var bucket = messageMap && messageMap[key];
      var message = (bucket && (bucket[code] || bucket.default)) || (messageMap && messageMap._fallback) || '';
      if (message) {
        setFieldError(form, key, message);
        mapped = true;
      }
    });
    return mapped;
  }

  function bindSubmitButton(button, options) {
    if (!button) {
      return { busy: function () {}, idle: function () {} };
    }
    var idleLabel = (options && options.idleLabel) || button.textContent;
    var busyLabel = (options && options.busyLabel) || '送信中…';
    return {
      busy: function () {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        if (!button.dataset.ariIdleLabel) button.dataset.ariIdleLabel = idleLabel;
        button.textContent = busyLabel;
      },
      idle: function () {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = button.dataset.ariIdleLabel || idleLabel;
      },
    };
  }

  function serializeForm(form) {
    var data = {};
    if (!form) return data;
    new FormData(form).forEach(function (value, key) {
      var input = fieldControl(form, key);
      if (input && input.type === 'checkbox') data[key] = input.checked;
      else data[key] = value;
    });
    return data;
  }

  function restoreForm(form, data) {
    if (!form || !data) return;
    Object.keys(data).forEach(function (key) {
      var input = fieldControl(form, key);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = !!data[key];
      else input.value = data[key] == null ? '' : String(data[key]);
    });
  }

  function saveDraft(storageKey, form) {
    if (!storageKey || !form) return;
    try {
      global.localStorage.setItem(storageKey, JSON.stringify(serializeForm(form)));
    } catch (_) { /* quota / private mode */ }
  }

  function restoreDraft(storageKey, form) {
    if (!storageKey || !form) return false;
    try {
      var raw = global.localStorage.getItem(storageKey);
      if (!raw) return false;
      restoreForm(form, JSON.parse(raw));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearDraft(storageKey) {
    if (!storageKey) return;
    try {
      global.localStorage.removeItem(storageKey);
    } catch (_) { /* noop */ }
  }

  function bindDraftAutosave(form, storageKey) {
    if (!form || !storageKey) return;
    restoreDraft(storageKey, form);
    var save = function () { saveDraft(storageKey, form); };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
  }

  global.AriFormUx = {
    bindSubmitButton: bindSubmitButton,
    clearFieldErrors: clearFieldErrors,
    setFieldError: setFieldError,
    mapServerFields: mapServerFields,
    bindDraftAutosave: bindDraftAutosave,
    saveDraft: saveDraft,
    restoreDraft: restoreDraft,
    clearDraft: clearDraft,
    serializeForm: serializeForm,
    restoreForm: restoreForm,
  };
})(window);
