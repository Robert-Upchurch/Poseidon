/* Poseidon shared — Settings modal.
   One self-contained component used by every dashboard (Master, Finance,
   Marketing). The modal injects its own DOM on first attach, themes itself
   to v6.5.0 tokens via the existing .dark / html:not(.dark) cascade.

   Public API:
     SettingsModal.attach(triggerEl)   wires a button (e.g. header gear)
     SettingsModal.open()              opens programmatically
     SettingsModal.close()             closes programmatically

   Reads / writes:
     localStorage 'poseidon-dashboard-token'  (canonical, matches KPIClient)
     localStorage 'poseidon-worker-url'       (canonical, matches KPIClient)
     config/worker.json                        (read-only seed for worker URL)

   Depends on:
     window.KPIClient (for getConfig + configure + summary)  — optional;
       if missing, the Save/Clear buttons still work but Test Connection
       reports "kpi-client-not-loaded". */

(function (root) {
  'use strict';

  var MODAL_ID = 'poseidon-settings-modal';
  var BACKDROP_ID = 'poseidon-settings-backdrop';
  var WORKER_KEY = 'poseidon-worker-url';
  var TOKEN_KEY  = 'poseidon-dashboard-token';
  var CONFIG_URL = 'config/worker.json';

  var attached = false;

  // ── injection ─────────────────────────────────────────────────
  function ensureMounted() {
    if (document.getElementById(MODAL_ID)) return;

    // Inject CSS once (scoped via .ps-* prefix).
    var style = document.createElement('style');
    style.id = 'poseidon-settings-modal-css';
    style.textContent = [
      '#' + BACKDROP_ID + '{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:90;opacity:0;pointer-events:none;transition:opacity .2s ease-out;}',
      '#' + BACKDROP_ID + '.open{opacity:1;pointer-events:auto;}',
      '#' + MODAL_ID + '{position:fixed;top:50%;left:50%;transform:translate(-50%,-46%);width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 80px);overflow-y:auto;border-radius:16px;border:1px solid;z-index:100;opacity:0;pointer-events:none;transition:opacity .2s ease-out,transform .25s cubic-bezier(.4,0,.2,1);box-shadow:0 24px 60px rgba(0,0,0,.45);}',
      '#' + MODAL_ID + '.open{opacity:1;pointer-events:auto;transform:translate(-50%,-50%);}',
      '.dark #' + MODAL_ID + '{background:#0f1e2e;border-color:#1e293b;color:#fafafa;}',
      'html:not(.dark) #' + MODAL_ID + '{background:#fff;border-color:#e2e8f0;color:#0f172a;}',
      '#' + MODAL_ID + ' .ps-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid;}',
      '.dark #' + MODAL_ID + ' .ps-head{border-bottom-color:#1e293b;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-head{border-bottom-color:#e2e8f0;}',
      '#' + MODAL_ID + ' .ps-head h2{margin:0;font-size:18px;font-weight:600;letter-spacing:-0.01em;display:flex;align-items:center;gap:10px;}',
      '#' + MODAL_ID + ' .ps-x{background:transparent;border:none;cursor:pointer;color:inherit;opacity:.7;padding:6px;border-radius:6px;}',
      '#' + MODAL_ID + ' .ps-x:hover{opacity:1;background:rgba(127,127,127,.12);}',
      '#' + MODAL_ID + ' .ps-body{padding:20px 22px 22px;display:flex;flex-direction:column;gap:18px;}',
      '#' + MODAL_ID + ' .ps-field{display:flex;flex-direction:column;gap:6px;}',
      '#' + MODAL_ID + ' .ps-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#64748b;}',
      '#' + MODAL_ID + ' .ps-row{display:flex;gap:8px;align-items:stretch;}',
      '#' + MODAL_ID + ' .ps-row > input{flex:1;min-width:0;}',
      '#' + MODAL_ID + ' input{padding:8px 12px;border-radius:8px;border:1px solid;font-size:13px;font-family:"JetBrains Mono","Consolas",monospace;width:100%;box-sizing:border-box;}',
      '.dark #' + MODAL_ID + ' input{background:#0a1628;border-color:#334155;color:#fafafa;}',
      'html:not(.dark) #' + MODAL_ID + ' input{background:#f8fafc;border-color:#cbd5e1;color:#0f172a;}',
      '#' + MODAL_ID + ' input[readonly]{opacity:.85;cursor:default;}',
      '#' + MODAL_ID + ' .ps-hint{font-size:11px;color:#94a3b8;line-height:1.5;}',
      '#' + MODAL_ID + ' .ps-icon-btn{background:transparent;border:1px solid;border-radius:8px;padding:0 10px;cursor:pointer;color:inherit;display:inline-flex;align-items:center;gap:6px;font-size:12px;}',
      '.dark #' + MODAL_ID + ' .ps-icon-btn{border-color:#334155;color:#cbd5e1;}',
      '.dark #' + MODAL_ID + ' .ps-icon-btn:hover{background:rgba(20,184,166,.10);}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-icon-btn{border-color:#cbd5e1;color:#1e293b;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-icon-btn:hover{background:#e0f2fe;}',
      '#' + MODAL_ID + ' .ps-actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:6px;}',
      '#' + MODAL_ID + ' .ps-btn{padding:9px 16px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s,color .15s;}',
      '#' + MODAL_ID + ' .ps-btn-primary{background:#14b8a6;color:#fff;}',
      '#' + MODAL_ID + ' .ps-btn-primary:hover{background:#0d9488;}',
      '#' + MODAL_ID + ' .ps-btn-ghost{background:transparent;border:1px solid;}',
      '.dark #' + MODAL_ID + ' .ps-btn-ghost{border-color:#334155;color:#cbd5e1;}',
      '.dark #' + MODAL_ID + ' .ps-btn-ghost:hover{background:rgba(127,127,127,.12);}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-btn-ghost{border-color:#cbd5e1;color:#1e293b;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-btn-ghost:hover{background:#f1f5f9;}',
      '#' + MODAL_ID + ' .ps-btn-danger{background:transparent;border:1px solid;color:#f87171;}',
      '#' + MODAL_ID + ' .ps-btn-danger:hover{background:rgba(244,63,94,.12);}',
      '.dark #' + MODAL_ID + ' .ps-btn-danger{border-color:#7f1d1d;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-btn-danger{border-color:#fecaca;color:#dc2626;}',
      '#' + MODAL_ID + ' .ps-status{font-size:12px;padding:10px 12px;border-radius:8px;line-height:1.4;display:none;}',
      '#' + MODAL_ID + ' .ps-status.show{display:block;}',
      '#' + MODAL_ID + ' .ps-status.ok{background:rgba(16,185,129,.10);border:1px solid rgba(16,185,129,.35);color:#34d399;}',
      '#' + MODAL_ID + ' .ps-status.err{background:rgba(244,63,94,.10);border:1px solid rgba(244,63,94,.35);color:#fb7185;}',
      '#' + MODAL_ID + ' .ps-status.info{background:rgba(20,184,166,.10);border:1px solid rgba(20,184,166,.35);color:#2dd4bf;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-status.ok{color:#047857;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-status.err{color:#b91c1c;}',
      'html:not(.dark) #' + MODAL_ID + ' .ps-status.info{color:#0e7490;}',
      '@media (max-width:520px){#' + MODAL_ID + ' .ps-actions{flex-direction:column;}#' + MODAL_ID + ' .ps-btn{justify-content:center;}}'
    ].join('\n');
    document.head.appendChild(style);

    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    // Modal shell
    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', MODAL_ID + '-h');
    modal.innerHTML = [
      '<div class="ps-head">',
      '  <h2 id="' + MODAL_ID + '-h"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>Settings</h2>',
      '  <button class="ps-x" data-ps-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>',
      '</div>',
      '<div class="ps-body">',
      '  <div class="ps-field">',
      '    <label class="ps-label" for="ps-worker">Worker URL</label>',
      '    <div class="ps-row">',
      '      <input id="ps-worker" type="text" readonly placeholder="(loading…)" />',
      '      <button type="button" class="ps-icon-btn" data-ps-copy="ps-worker" aria-label="Copy worker URL">',
      '        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      '        Copy',
      '      </button>',
      '    </div>',
      '    <div class="ps-hint">Auto-loaded from <code>config/worker.json</code>. Read-only here.</div>',
      '  </div>',
      '  <div class="ps-field">',
      '    <label class="ps-label" for="ps-token">Dashboard Token <span style="text-transform:none;font-weight:400;opacity:.6;">(X-Dashboard-Token)</span></label>',
      '    <div class="ps-row">',
      '      <input id="ps-token" type="password" placeholder="paste your dashboard token…" autocomplete="off" spellcheck="false" />',
      '      <button type="button" class="ps-icon-btn" data-ps-eye aria-label="Show/hide token" aria-pressed="false">',
      '        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
      '        <span data-ps-eye-label>Show</span>',
      '      </button>',
      '    </div>',
      '    <div class="ps-hint">Stored per-device in <code>localStorage.poseidon-dashboard-token</code>. Cleared on Sign Out.</div>',
      '  </div>',
      '  <div class="ps-actions">',
      '    <button type="button" class="ps-btn ps-btn-ghost" data-ps-test>',
      '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      '      Test connection',
      '    </button>',
      '    <button type="button" class="ps-btn ps-btn-primary" data-ps-save>',
      '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
      '      Save',
      '    </button>',
      '    <button type="button" class="ps-btn ps-btn-danger" data-ps-clear>',
      '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
      '      Clear',
      '    </button>',
      '  </div>',
      '  <div class="ps-status" data-ps-status role="status" aria-live="polite"></div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(modal);

    wireEvents();
    loadInitialValues();
  }

  // ── wiring ────────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function modal() { return document.getElementById(MODAL_ID); }
  function backdrop() { return document.getElementById(BACKDROP_ID); }

  function wireEvents() {
    backdrop().addEventListener('click', close);
    modal().addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-ps-close]'); if (t) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });

    modal().addEventListener('click', function (e) {
      var copy = e.target.closest && e.target.closest('[data-ps-copy]');
      if (copy) handleCopy(copy.getAttribute('data-ps-copy'));
      var eye = e.target.closest && e.target.closest('[data-ps-eye]');
      if (eye) handleEye(eye);
      var test = e.target.closest && e.target.closest('[data-ps-test]');
      if (test) handleTest();
      var save = e.target.closest && e.target.closest('[data-ps-save]');
      if (save) handleSave();
      var clear = e.target.closest && e.target.closest('[data-ps-clear]');
      if (clear) handleClear();
    });

    // Save on Enter inside the token field.
    var tok = $('#ps-token');
    tok.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    });
  }

  function loadInitialValues() {
    var workerInput = $('#ps-worker');
    var tokInput = $('#ps-token');

    // Worker URL: localStorage first, then config/worker.json.
    var fromLs = '';
    try { fromLs = localStorage.getItem(WORKER_KEY) || ''; } catch (e) {}
    if (fromLs) workerInput.value = fromLs;

    fetch(CONFIG_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.worker_url) {
          workerInput.value = j.worker_url;
          try {
            if (!localStorage.getItem(WORKER_KEY)) localStorage.setItem(WORKER_KEY, j.worker_url);
          } catch (e) {}
        } else if (!workerInput.value) {
          workerInput.placeholder = '(config/worker.json not found)';
        }
      })
      .catch(function () {
        if (!workerInput.value) workerInput.placeholder = '(config/worker.json unreachable)';
      });

    // Token: load from localStorage if present (masked by default).
    try { tokInput.value = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
  }

  // ── actions ───────────────────────────────────────────────────
  function status(kind, text) {
    var el = $('[data-ps-status]');
    el.className = 'ps-status show ' + kind;
    el.textContent = text;
  }
  function clearStatus() {
    var el = $('[data-ps-status]');
    el.className = 'ps-status';
    el.textContent = '';
  }

  function handleCopy(targetId) {
    var el = document.getElementById(targetId);
    if (!el || !el.value) return;
    try {
      navigator.clipboard.writeText(el.value).then(function () {
        status('ok', 'Copied to clipboard.');
        setTimeout(clearStatus, 1500);
      });
    } catch (e) {
      el.select(); document.execCommand && document.execCommand('copy');
      status('ok', 'Copied.');
    }
  }

  function handleEye(btn) {
    var input = $('#ps-token');
    var label = btn.querySelector('[data-ps-eye-label]');
    if (input.type === 'password') {
      input.type = 'text';
      btn.setAttribute('aria-pressed', 'true');
      if (label) label.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = 'Show';
    }
  }

  function handleTest() {
    clearStatus();
    var url = ($('#ps-worker').value || '').replace(/\/+$/, '');
    var token = $('#ps-token').value || '';
    if (!url) return status('err', 'Worker URL is empty. Reload after config/worker.json deploys.');
    if (!token) return status('err', 'Paste your Dashboard Token first.');
    status('info', 'Pinging ' + url + '/api/kpi-summary?scope=master …');
    fetch(url + '/api/kpi-summary?scope=master', {
      method: 'GET',
      headers: { 'X-Dashboard-Token': token, 'Accept': 'application/json' },
      credentials: 'omit'
    }).then(function (r) {
      if (r.ok) {
        return r.json().then(function (j) {
          var tiles = (j.kpis || []).length;
          status('ok', '✓ ' + r.status + ' OK · scope=' + (j.scope || '?') + ' · ' + tiles + ' KPI tiles · source=' + (j.source_state && j.source_state.primary));
        });
      }
      return r.text().then(function (t) {
        var hint = r.status === 401 ? 'Token is invalid — check the value in your Cloudflare Worker secret.'
                 : r.status === 403 ? 'Forbidden — CORS or origin mismatch.'
                 : 'HTTP ' + r.status;
        status('err', '✗ ' + hint);
      });
    }).catch(function (err) {
      status('err', '✗ Network error: ' + (err && err.message || err));
    });
  }

  function handleSave() {
    var token = $('#ps-token').value || '';
    if (!token) return status('err', 'Token is empty — paste it first, or use Clear to wipe.');
    try {
      localStorage.setItem(TOKEN_KEY, token);
      if (root.KPIClient && root.KPIClient.clearCache) root.KPIClient.clearCache();
      status('ok', '✓ Saved. KPI cache cleared — close this panel to refresh tiles.');
    } catch (e) {
      status('err', '✗ localStorage write failed: ' + (e && e.message || e));
    }
  }

  function handleClear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      if (root.KPIClient && root.KPIClient.clearCache) root.KPIClient.clearCache();
      $('#ps-token').value = '';
      status('info', 'Cleared. The dashboard will fall back to skeleton tiles until you Save again.');
    } catch (e) {
      status('err', '✗ Could not clear: ' + (e && e.message || e));
    }
  }

  // ── public surface ────────────────────────────────────────────
  function open() {
    ensureMounted();
    var m = modal(); var b = backdrop();
    m.classList.add('open'); b.classList.add('open');
    setTimeout(function () { var t = $('#ps-token'); if (t) t.focus(); }, 50);
    document.body.style.overflow = 'hidden';
  }

  function close() {
    var m = modal(); var b = backdrop();
    if (!m) return;
    m.classList.remove('open'); b.classList.remove('open');
    document.body.style.overflow = '';
    clearStatus();
  }

  function isOpen() {
    var m = modal();
    return m && m.classList.contains('open');
  }

  function attach(triggerEl) {
    if (!triggerEl) return;
    if (attached === false) { ensureMounted(); attached = true; }
    triggerEl.addEventListener('click', function (e) { e.preventDefault(); open(); });
    triggerEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  }

  root.SettingsModal = { attach: attach, open: open, close: close };
})(typeof window !== 'undefined' ? window : globalThis);
