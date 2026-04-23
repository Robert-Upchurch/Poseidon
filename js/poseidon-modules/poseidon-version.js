/* ═══════════════════════════════════════════════════════════════════
   POSEIDON — VERSION & CHANGELOG
   Always-visible build/version badge + modal changelog viewer.
   Config: /config/changelog.json
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CONFIG_URL = 'config/changelog.json';
  let LOG = null;
  let modalEl = null;

  const CATEGORY_META = {
    feature:     { label: 'Feature',     color: '#2dd4bf', bg: 'rgba(20,184,166,0.15)' },
    ui:          { label: 'UI',          color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
    integration: { label: 'Integration', color: '#e879f9', bg: 'rgba(217,70,239,0.15)' },
    fix:         { label: 'Fix',         color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
    perf:        { label: 'Performance', color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
    security:    { label: 'Security',    color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
    docs:        { label: 'Docs',        color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
  };

  const STYLE_ID = 'poseidon-version-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      #poseidon-version-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.28);color:#2dd4bf;font-size:11px;font-weight:700;padding:6px 10px;border-radius:8px;cursor:pointer;letter-spacing:0.04em;font-family:'JetBrains Mono',monospace;transition:all 0.15s;}
      #poseidon-version-btn:hover{background:rgba(20,184,166,0.22);border-color:rgba(20,184,166,0.55);transform:translateY(-1px);}
      #poseidon-version-btn .pv-dot{width:6px;height:6px;border-radius:50%;background:#14b8a6;box-shadow:0 0 8px #14b8a6;}
      #poseidon-version-modal{position:fixed;inset:0;z-index:9998;display:none;font-family:'Inter',system-ui,sans-serif;}
      #poseidon-version-modal.active{display:flex;align-items:center;justify-content:center;}
      #poseidon-version-modal .pv-backdrop{position:absolute;inset:0;background:rgba(5,11,22,0.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
      #poseidon-version-modal .pv-panel{position:relative;background:linear-gradient(160deg,#0f1e2e,#122336);border:1px solid rgba(20,184,166,0.30);border-radius:16px;width:min(820px,calc(100vw - 24px));max-height:calc(100vh - 60px);display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,0.6);color:#e2e8f0;overflow:hidden;}
      #poseidon-version-modal .pv-head{padding:20px 24px;border-bottom:1px solid rgba(148,163,184,0.14);display:flex;gap:14px;align-items:center;flex-wrap:wrap;}
      #poseidon-version-modal .pv-title{font-size:1.2rem;font-weight:800;letter-spacing:-0.02em;color:#f1f5f9;display:flex;gap:10px;align-items:center;}
      #poseidon-version-modal .pv-current{background:linear-gradient(135deg,#14b8a6,#0ea5e9);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:0.06em;}
      #poseidon-version-modal .pv-close{margin-left:auto;background:transparent;border:0;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px 10px;border-radius:6px;}
      #poseidon-version-modal .pv-close:hover{background:rgba(148,163,184,0.1);color:#f1f5f9;}
      #poseidon-version-modal .pv-body{flex:1;overflow-y:auto;padding:0;}
      #poseidon-version-modal .pv-release{padding:22px 24px;border-bottom:1px solid rgba(148,163,184,0.08);}
      #poseidon-version-modal .pv-release:last-child{border-bottom:0;}
      #poseidon-version-modal .pv-release-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px;}
      #poseidon-version-modal .pv-ver{font-family:'JetBrains Mono',monospace;font-size:1.4rem;font-weight:800;color:#2dd4bf;letter-spacing:-0.02em;}
      #poseidon-version-modal .pv-codename{font-size:12px;color:#94a3b8;margin-left:8px;font-style:italic;}
      #poseidon-version-modal .pv-date{font-size:12px;color:#64748b;font-family:'JetBrains Mono',monospace;}
      #poseidon-version-modal .pv-summary{font-size:13px;color:#cbd5e1;line-height:1.6;margin:10px 0 14px;}
      #poseidon-version-modal .pv-highlights{background:rgba(20,184,166,0.08);border-left:3px solid #14b8a6;padding:12px 14px;border-radius:0 8px 8px 0;margin-bottom:16px;}
      #poseidon-version-modal .pv-highlights-title{font-size:10px;font-weight:700;color:#2dd4bf;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;}
      #poseidon-version-modal .pv-highlights ul{margin:0;padding-left:18px;}
      #poseidon-version-modal .pv-highlights li{font-size:12.5px;color:#e2e8f0;line-height:1.7;}
      #poseidon-version-modal .pv-changes{display:grid;gap:6px;}
      #poseidon-version-modal .pv-change{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.55;color:#cbd5e1;}
      #poseidon-version-modal .pv-chip{flex-shrink:0;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.08em;text-transform:uppercase;margin-top:2px;min-width:70px;text-align:center;}
      #poseidon-version-modal .pv-meta{font-size:11px;color:#64748b;padding:14px 24px;border-top:1px solid rgba(148,163,184,0.08);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      @media (max-width:640px){
        #poseidon-version-modal .pv-panel{width:100%;height:100%;max-height:100vh;border-radius:0;border:0;}
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function loadConfig() {
    if (LOG) return LOG;
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
      LOG = await res.json();
    } catch (e) {
      console.warn('[Poseidon Version] config fetch failed', e);
      LOG = { currentVersion: '?.?.?', releases: [] };
    }
    return LOG;
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function render() {
    if (!modalEl || !LOG) return;
    const body = modalEl.querySelector('.pv-body');
    const html = (LOG.releases || []).map(r => {
      const highlights = (r.highlights || []).map(h => `<li>${escapeHtml(h)}</li>`).join('');
      const changes = (r.changes || []).map(c => {
        const meta = CATEGORY_META[c.category] || CATEGORY_META.feature;
        return `<div class="pv-change">
          <span class="pv-chip" style="background:${meta.bg};color:${meta.color}">${meta.label}</span>
          <span>${escapeHtml(c.text)}</span>
        </div>`;
      }).join('');
      return `
        <div class="pv-release">
          <div class="pv-release-head">
            <div>
              <span class="pv-ver">v${escapeHtml(r.version)}</span>
              ${r.codename ? `<span class="pv-codename">"${escapeHtml(r.codename)}"</span>` : ''}
            </div>
            <div class="pv-date">${escapeHtml(r.date || '')}</div>
          </div>
          ${r.summary ? `<div class="pv-summary">${escapeHtml(r.summary)}</div>` : ''}
          ${highlights ? `<div class="pv-highlights"><div class="pv-highlights-title">Highlights</div><ul>${highlights}</ul></div>` : ''}
          <div class="pv-changes">${changes}</div>
        </div>`;
    }).join('');
    body.innerHTML = html || '<div style="padding:40px;text-align:center;color:#64748b">No release history yet.</div>';
  }

  function buildModal() {
    if (modalEl) return modalEl;
    injectStyle();
    modalEl = document.createElement('div');
    modalEl.id = 'poseidon-version-modal';
    modalEl.innerHTML = `
      <div class="pv-backdrop" data-action="close"></div>
      <div class="pv-panel">
        <div class="pv-head">
          <div class="pv-title">🧾 Version & Changelog</div>
          <span class="pv-current" id="pv-current-version"></span>
          <button class="pv-close" data-action="close" aria-label="Close">&times;</button>
        </div>
        <div class="pv-body"></div>
        <div class="pv-meta"></div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', e => { if (e.target.dataset.action === 'close') close(); });
    window.addEventListener('keydown', e => { if (modalEl.classList.contains('active') && e.key === 'Escape') close(); });
    return modalEl;
  }

  async function open() {
    await loadConfig();
    buildModal();
    modalEl.querySelector('#pv-current-version').textContent = `v${LOG.currentVersion || '?'}`;
    modalEl.querySelector('.pv-meta').innerHTML = `
      <span>Codename: <strong style="color:#e2e8f0">${escapeHtml(LOG.currentCodename || '—')}</strong></span>
      <span>${(LOG.releases || []).length} releases tracked</span>
    `;
    modalEl.classList.add('active');
    render();
  }
  function close() { if (modalEl) modalEl.classList.remove('active'); }

  function addHeaderButton() {
    const header = document.querySelector('#app-header .header-actions');
    if (!header || document.getElementById('poseidon-version-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'poseidon-version-btn';
    btn.title = 'Version & Changelog';
    btn.innerHTML = `<span class="pv-dot"></span><span id="pv-version-label">v${(LOG && LOG.currentVersion) || '…'}</span>`;
    btn.onclick = open;
    header.insertBefore(btn, header.firstChild);
  }

  function bootstrap() {
    loadConfig().then(() => {
      addHeaderButton();
      const lbl = document.getElementById('pv-version-label');
      if (lbl) lbl.textContent = 'v' + (LOG.currentVersion || '0.0.0');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();

  window.PoseidonVersion = {
    open, close,
    getCurrent: () => LOG ? LOG.currentVersion : null,
    reloadConfig: async () => { LOG = null; await loadConfig(); const lbl = document.getElementById('pv-version-label'); if (lbl) lbl.textContent = 'v' + LOG.currentVersion; render(); }
  };
})();
