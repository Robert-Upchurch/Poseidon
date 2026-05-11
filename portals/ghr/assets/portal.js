/* GHR Portal - shared client JS
 * Theme toggle, form validation, intake step machine, Worker fetch + offline fallback.
 * No external dependencies. ES5+ compatible.
 */
(function () {
  'use strict';

  // -------- THEME (light default for public marketing pages) --------
  var THEME_KEY = 'ghr-theme';
  function applyTheme(theme) {
    var html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }
  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; }
    catch (e) { return 'light'; }
  }
  function writeTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }
  applyTheme(readTheme());

  function wireThemeToggle() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(next);
      writeTheme(next);
      updateToggleIcon(btn, next);
    });
    updateToggleIcon(btn, readTheme());
  }
  function updateToggleIcon(btn, theme) {
    btn.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // -------- WORKER CONFIG --------
  // 1. Inline override (window.GHR_PORTAL_WORKER_URL) wins if set.
  // 2. Otherwise auto-fetch ../../config/worker.json on load.
  var workerUrl = (window.GHR_PORTAL_WORKER_URL || '').replace(/\/$/, '');
  var workerReady = workerUrl
    ? Promise.resolve(workerUrl)
    : fetch('../../config/worker.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && j.worker_url) workerUrl = j.worker_url.replace(/\/$/, '');
          return workerUrl;
        })
        .catch(function () { return ''; });
  function endpoint(path) { return (workerUrl || '') + path; }

  // -------- FORM VALIDATION --------
  function validateField(input) {
    var wrap = input.closest('[data-field]');
    if (!wrap) return true;
    var val = (input.value || '').trim();
    var required = input.hasAttribute('required');
    var type = input.getAttribute('type') || input.tagName.toLowerCase();
    var ok = true;
    if (required && !val) ok = false;
    if (ok && val && type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (ok && val && type === 'tel') ok = /^[0-9+()\-\s]{7,}$/.test(val);
    wrap.classList.toggle('has-error', !ok);
    return ok;
  }

  function validatePane(pane) {
    var ok = true;
    var inputs = pane.querySelectorAll('input[required], select[required], textarea[required]');
    for (var i = 0; i < inputs.length; i++) {
      if (!validateField(inputs[i])) ok = false;
    }
    return ok;
  }

  function wireValidation(root) {
    var inputs = (root || document).querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('blur', function (e) { validateField(e.target); });
    }
  }

  // -------- STEP MACHINE (intake) --------
  function wireStepper() {
    var form = document.querySelector('[data-step-form]');
    if (!form) return;
    var panes = form.querySelectorAll('.step-pane');
    var steps = form.querySelectorAll('.step');
    var current = 0;

    function showStep(idx) {
      for (var i = 0; i < panes.length; i++) panes[i].classList.toggle('active', i === idx);
      for (var j = 0; j < steps.length; j++) {
        if (j <= idx) { steps[j].classList.add('step-active'); steps[j].classList.remove('step-idle'); }
        else { steps[j].classList.add('step-idle'); steps[j].classList.remove('step-active'); }
      }
      var lastIdx = panes.length - 1;
      if (idx === lastIdx) buildReview(form, panes[lastIdx]);
      current = idx;
      try { window.scrollTo({ top: form.offsetTop - 80, behavior: 'smooth' }); } catch (e) {}
    }

    form.addEventListener('click', function (e) {
      var target = e.target;
      if (target.matches('[data-step-next]')) {
        e.preventDefault();
        if (!validatePane(panes[current])) return;
        if (current < panes.length - 1) showStep(current + 1);
      } else if (target.matches('[data-step-back]')) {
        e.preventDefault();
        if (current > 0) showStep(current - 1);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validatePane(panes[current])) return;
      submitApplication(form);
    });

    showStep(0);
  }

  function buildReview(form, pane) {
    var slot = pane.querySelector('[data-review-slot]');
    if (!slot) return;
    var data = collectFormData(form);
    var html = '';
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      if (k === '_files') continue;
      var label = k.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var val = data[k];
      if (Array.isArray(val)) val = val.join(', ');
      if (!val) val = '-';
      html += '<div class="review-line"><span>' + escapeHtml(label) + '</span><span>' + escapeHtml(String(val)) + '</span></div>';
    }
    if (data._files && data._files.length) {
      html += '<div class="review-line"><span>Files queued</span><span>' + data._files.length + ' file(s)</span></div>';
    }
    slot.innerHTML = html;
  }

  function collectFormData(form) {
    var out = {};
    var inputs = form.querySelectorAll('input, select, textarea');
    var files = [];
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      var name = inp.name;
      if (!name) continue;
      if (inp.type === 'file') {
        if (inp.files && inp.files.length) {
          for (var f = 0; f < inp.files.length; f++) {
            files.push({ field: name, name: inp.files[f].name, size: inp.files[f].size });
          }
        }
        continue;
      }
      if (inp.type === 'checkbox') {
        if (inp.checked) {
          if (out[name]) out[name] = [].concat(out[name], inp.value);
          else out[name] = inp.value;
        }
        continue;
      }
      if (inp.type === 'radio') {
        if (inp.checked) out[name] = inp.value;
        continue;
      }
      out[name] = (inp.value || '').trim();
    }
    out._files = files;
    out._captured_at = new Date().toISOString();
    out._target_module = form.getAttribute('data-target-module') || null;
    out._portal = form.getAttribute('data-portal') || null;
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // -------- SUBMIT (with offline fallback) --------
  function submitApplication(form) {
    var data = collectFormData(form);
    var path = form.getAttribute('data-submit-path') || '/api/portal-intake/ghr';
    var status = form.querySelector('[data-submit-status]');
    setStatus(status, 'info', 'Submitting application...');
    workerReady.then(function () { doSubmitApplication(form, data, path, status); });
  }

  function doSubmitApplication(form, data, path, status) {
    if (!workerUrl) {
      stashOffline(data);
      setStatus(status, 'warn', 'Saved offline - your application will sync when the Worker is live.');
      disableForm(form);
      return;
    }

    fetch(endpoint(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (resp) {
      if (resp.status === 404) {
        stashOffline(data);
        setStatus(status, 'warn', 'Saved offline - your application will sync when the Worker is live.');
        disableForm(form);
        return null;
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (json) {
      if (!json) return;
      setStatus(status, 'ok', 'Application received. Check your email for a tracking link.');
      disableForm(form);
      if (json.status_url) setTimeout(function () { window.location.href = json.status_url; }, 2000);
    }).catch(function () {
      stashOffline(data);
      setStatus(status, 'warn', 'Saved offline - your application will sync when the Worker is live.');
      disableForm(form);
    });
  }

  function stashOffline(data) {
    try {
      var key = 'ghr-pending';
      var existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(data);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {}
  }

  function setStatus(el, kind, message) {
    if (!el) return;
    el.className = 'notice notice-' + kind;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function disableForm(form) {
    var inputs = form.querySelectorAll('input, select, textarea, button');
    for (var i = 0; i < inputs.length; i++) inputs[i].disabled = true;
  }

  // -------- CONTACT FORM --------
  function wireContact() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    var status = form.querySelector('[data-submit-status]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var inputs = form.querySelectorAll('input[required], textarea[required]');
      for (var i = 0; i < inputs.length; i++) if (!validateField(inputs[i])) ok = false;
      if (!ok) return;
      var data = collectFormData(form);
      var path = form.getAttribute('data-submit-path') || '/api/portal-intake/ghr';
      setStatus(status, 'info', 'Sending message...');
      workerReady.then(function () { sendContact(form, data, path, status); });
    });
    wireValidation(form);
  }

  function sendContact(form, data, path, status) {
      if (!workerUrl) {
        setStatus(status, 'warn', 'Saved locally - message will deliver once the Worker is live.');
        disableForm(form);
        return;
      }
      fetch(endpoint(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (resp) {
        if (resp.status === 404) {
          setStatus(status, 'warn', 'Saved locally - message will deliver once the Worker is live.');
          disableForm(form);
          return;
        }
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        setStatus(status, 'ok', 'Thanks - we will reply within one business day.');
        disableForm(form);
      }).catch(function () {
        setStatus(status, 'warn', 'Saved locally - message will deliver once the Worker is live.');
        disableForm(form);
      });
  }

  // -------- POSITIONS FILTER --------
  function wirePositionFilter() {
    var grid = document.querySelector('[data-positions-grid]');
    if (!grid) return;
    var cards = grid.querySelectorAll('[data-position]');
    var selects = document.querySelectorAll('[data-positions-filter]');

    function apply() {
      var filters = {};
      for (var i = 0; i < selects.length; i++) {
        var key = selects[i].getAttribute('data-positions-filter');
        var val = selects[i].value;
        if (val && val !== 'all') filters[key] = val.toLowerCase();
      }
      var visible = 0;
      for (var j = 0; j < cards.length; j++) {
        var card = cards[j];
        var show = true;
        for (var k in filters) {
          if (!Object.prototype.hasOwnProperty.call(filters, k)) continue;
          var attr = (card.getAttribute('data-' + k) || '').toLowerCase();
          if (attr.indexOf(filters[k]) === -1) { show = false; break; }
        }
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      }
      var count = document.querySelector('[data-positions-count]');
      if (count) count.textContent = visible + ' position' + (visible === 1 ? '' : 's');
    }
    for (var s = 0; s < selects.length; s++) selects[s].addEventListener('change', apply);
    apply();
  }

  // -------- TRACK PAGE --------
  function wireTrack() {
    var root = document.querySelector('[data-track-root]');
    if (!root) return;
    var statusSlot = root.querySelector('[data-track-status]');
    var portal = root.getAttribute('data-portal') || 'ghr';

    function param(name) {
      var match = new RegExp('[?&]' + name + '=([^&]+)').exec(window.location.search);
      return match ? decodeURIComponent(match[1]) : null;
    }
    var token = param('token');
    if (!token) {
      statusSlot.innerHTML = '<div class="notice notice-info">Enter the tracking link from your application confirmation email. Lost it? <a href="contact.html">Contact us</a>.</div>';
      return;
    }
    workerReady.then(function () {
    if (!workerUrl) {
      statusSlot.innerHTML = '<div class="notice notice-info">Your tracking link is being prepared - check back shortly.</div>';
      return;
    }
    fetch(endpoint('/api/portal-status/' + encodeURIComponent(token))).then(function (resp) {
      if (resp.status === 404) {
        statusSlot.innerHTML = '<div class="notice notice-info">Your tracking link is being prepared - check back shortly.</div>';
        return null;
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (json) {
      if (!json) return;
      renderTrackStatus(statusSlot, json);
    }).catch(function () {
      statusSlot.innerHTML = '<div class="notice notice-warn">We could not load your status right now. Please refresh in a few minutes.</div>';
    });
    });
  }

  function renderTrackStatus(slot, data) {
    var stage = data.stage || 'Submitted';
    var updated = data.last_updated || '';
    var housing = data.housing_preview_safe || null;
    var html = '<div class="card" style="padding:32px;">';
    html += '<p class="section-eyebrow" style="margin:0;">Current stage</p>';
    html += '<h2 style="font-size:32px;margin:8px 0 6px;letter-spacing:-0.02em;">' + escapeHtml(stage) + '</h2>';
    if (updated) html += '<p class="muted" style="margin:0;font-size:14px;">Last updated ' + escapeHtml(updated) + '</p>';
    if (housing) {
      html += '<div style="margin-top:24px;padding-top:24px;border-top:1px solid;border-color:inherit;">';
      html += '<p class="section-eyebrow" style="margin:0;">Housing summary</p>';
      var lines = [];
      if (housing.region) lines.push('Region: ' + housing.region);
      if (housing.beds_filled_pct != null) lines.push('Beds filled in your region: ' + housing.beds_filled_pct + '%');
      if (housing.summary) lines.push(housing.summary);
      var addrNote = 'Address is confirmed after your placement deposit is received.';
      lines.push(addrNote);
      for (var i = 0; i < lines.length; i++) {
        html += '<p style="margin:8px 0 0;">' + escapeHtml(lines[i]) + '</p>';
      }
      html += '</div>';
    }
    html += '</div>';
    slot.innerHTML = html;
  }

  // -------- BOOT --------
  function boot() {
    wireThemeToggle();
    wireValidation(document);
    wireStepper();
    wireContact();
    wirePositionFilter();
    wireTrack();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
