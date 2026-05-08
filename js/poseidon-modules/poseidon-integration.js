/* ═══════════════════════════════════════════════════════════════════
   POSEIDON — INTEGRATION LOADER
   Single entrypoint that loads all five upgrade modules and wires
   them into the existing V6 dashboard without touching existing code.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BASE = (function () {
    const script = document.currentScript
      || document.querySelector('script[src*="poseidon-integration"]');
    if (!script) return 'js/poseidon-modules/';
    return script.src.replace(/poseidon-integration\.js.*$/, '');
  })();

  // Version stamp appended to every module URL as ?v=… so a bump
  // invalidates browser HTTP cache + SW static cache for ALL modules
  // in one shot. Bump whenever any module under js/poseidon-modules/
  // changes. Format: YYYY-MM-DD-tag.
  // 2026-05-07-skills — added Jarvis Skills Library tools
  //   (query_skill, classify_skill_domain, list_skill_domains).
  const MODULES_VERSION = '2026-05-08-eastern-time';

  const MODULES = [
    'poseidon-training.js',
    'poseidon-directory.js',
    'poseidon-version.js',
    'poseidon-llm.js',
    'poseidon-jarvis-memory.js',
    'poseidon-jarvis-grok.js',
    'poseidon-zoho-books.js',
    'poseidon-toolbar.js'
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = false; // preserve order
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  (async () => {
    try {
      const qs = '?v=' + encodeURIComponent(MODULES_VERSION);
      for (const m of MODULES) await loadScript(BASE + m + qs);
      console.log('[Poseidon] All enhancement modules loaded from', BASE, 'version', MODULES_VERSION);
      bootstrapIntegrations();
    } catch (e) {
      console.error('[Poseidon] Integration loader failed:', e);
    }
  })();

  // ─── Settings-page integration ──────────────────────────────────
  function bootstrapIntegrations() {
    // Wait for settings page to exist
    const injectSettings = () => {
      const settingsPage = document.getElementById('settings');
      if (!settingsPage) return false;
      if (settingsPage.querySelector('#poseidon-enhancements-block')) return true;

      const block = document.createElement('div');
      block.id = 'poseidon-enhancements-block';
      block.className = 'bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 mt-4';
      block.innerHTML = `
        <h3 class="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <span>🔱</span> Poseidon Enhancements
        </h3>
        <p class="text-xs text-zinc-500 mb-4">Training, Directory, Changelog, LLM Layer, and Jarvis Voice assistant.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button id="pe-replay-training"
            class="px-4 py-3 text-left bg-zinc-900/60 border border-zinc-800 hover:border-teal-500/50 rounded-lg transition-all">
            <div class="text-sm font-semibold text-zinc-100">🎓 Replay Onboarding Tour</div>
            <div class="text-xs text-zinc-500 mt-1">Re-run the interactive training module.</div>
          </button>
          <button id="pe-open-directory"
            class="px-4 py-3 text-left bg-zinc-900/60 border border-zinc-800 hover:border-teal-500/50 rounded-lg transition-all">
            <div class="text-sm font-semibold text-zinc-100">📚 Open Directory</div>
            <div class="text-xs text-zinc-500 mt-1">Searchable manifest of every link and program.</div>
          </button>
          <button id="pe-open-changelog"
            class="px-4 py-3 text-left bg-zinc-900/60 border border-zinc-800 hover:border-teal-500/50 rounded-lg transition-all">
            <div class="text-sm font-semibold text-zinc-100">🧾 Changelog</div>
            <div class="text-xs text-zinc-500 mt-1">Full version history &amp; release notes.</div>
          </button>
          <button id="pe-jarvis"
            class="px-4 py-3 text-left bg-zinc-900/60 border border-zinc-800 hover:border-teal-500/50 rounded-lg transition-all">
            <div class="text-sm font-semibold text-zinc-100">🎙 Jarvis Voice Panel</div>
            <div class="text-xs text-zinc-500 mt-1">Launch the Grok-powered voice assistant.</div>
          </button>
        </div>
        <div class="mt-5 pt-4 border-t border-zinc-800">
          <label class="block text-xs font-semibold text-zinc-400 mb-2">🔑 xAI Grok API Key</label>
          <div class="flex gap-2 flex-wrap">
            <input id="pe-grok-key" type="password" autocomplete="off"
              placeholder="xai-…"
              class="flex-1 min-w-[240px] px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 font-mono" />
            <button id="pe-save-key"
              class="px-4 py-2 text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all">
              Save Key
            </button>
            <button id="pe-test-key"
              class="px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg transition-all">
              Test Connection
            </button>
          </div>
          <p class="text-[11px] text-zinc-600 mt-2">
            Stored locally in your browser (localStorage). The key is sent over TLS directly to
            <code class="text-teal-400">api.x.ai</code>. For production, proxy through a token-minting backend.
          </p>
          <div id="pe-key-status" class="text-xs mt-2"></div>

          <label class="block text-xs font-semibold text-zinc-400 mb-2 mt-4">🎛 Voice Engine</label>
          <select id="pe-voice-engine" class="px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 w-full">
            <option value="auto">Auto — try Grok realtime, fall back to Browser (recommended)</option>
            <option value="websocket">Grok Realtime only — requires voice access on your xAI team</option>
            <option value="browser">Browser Speech (always works) — STT/TTS locally + Grok chat + tools</option>
          </select>
          <p class="text-[11px] text-zinc-600 mt-1">
            xAI's realtime voice is gated to select teams. Browser mode uses
            <code class="text-teal-400">/v1/chat/completions</code> + your browser's speech APIs and
            works today with full tool-calling.
          </p>

          <label class="block text-xs font-semibold text-zinc-400 mb-2 mt-4">🎵 Grok Realtime Voice (WebSocket only)</label>
          <select id="pe-grok-voice" class="px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
            <option value="eve">Eve — xAI default</option>
          </select>
          <p class="text-[11px] text-zinc-600 mt-1">
            xAI realtime uses model <code class="text-teal-400">grok-voice-think-fast-1.0</code>.
            Voice catalog may expand; "eve" is the current documented option.
          </p>

          <label class="block text-xs font-semibold text-zinc-400 mb-2 mt-4">🌐 Tavily Web-Search Fallback Key</label>
          <div class="flex gap-2 flex-wrap">
            <input id="pe-tavily-key" type="password" autocomplete="off"
              placeholder="tvly-…"
              class="flex-1 min-w-[240px] px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 font-mono" />
            <button id="pe-save-tavily"
              class="px-4 py-2 text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all">Save</button>
            <button id="pe-test-tavily"
              class="px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg transition-all">Test</button>
          </div>
          <p class="text-[11px] text-zinc-600 mt-2">
            Independent fallback for when xAI search is rate-limited or down.
            Free tier 1,000 searches/month at <code class="text-teal-400">tavily.com</code>.
            Stored locally; sent over TLS to <code class="text-teal-400">api.tavily.com</code>.
          </p>
          <div id="pe-tavily-status" class="text-xs mt-2"></div>

          <label class="block text-xs font-semibold text-zinc-400 mb-2 mt-4">🤖 Text Model (Browser mode)</label>
          <select id="pe-text-model" class="px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 w-full">
            <option value="grok-4.20-0309-reasoning">grok-4.20-0309-reasoning — latest, best tool-calling</option>
            <option value="grok-4.20-0309-non-reasoning">grok-4.20-0309-non-reasoning — faster, cheaper</option>
            <option value="grok-4-fast-reasoning">grok-4-fast-reasoning — speed-optimized</option>
            <option value="grok-4-fast-non-reasoning">grok-4-fast-non-reasoning — fastest</option>
            <option value="grok-3">grok-3 — legacy</option>
          </select>
        </div>
      `;
      settingsPage.appendChild(block);

      // Wire up
      block.querySelector('#pe-replay-training').onclick = () => window.PoseidonTraining && window.PoseidonTraining.restart();
      block.querySelector('#pe-open-directory').onclick  = () => window.PoseidonDirectory && window.PoseidonDirectory.open();
      block.querySelector('#pe-open-changelog').onclick  = () => window.PoseidonVersion && window.PoseidonVersion.open();
      block.querySelector('#pe-jarvis').onclick          = () => window.PoseidonJarvis && window.PoseidonJarvis.open();

      const keyInput     = block.querySelector('#pe-grok-key');
      const voiceSelect  = block.querySelector('#pe-grok-voice');
      const engineSelect = block.querySelector('#pe-voice-engine');
      const modelSelect  = block.querySelector('#pe-text-model');
      if (window.PoseidonJarvis) {
        keyInput.value = window.PoseidonJarvis.getApiKey();
        voiceSelect.value  = window.PoseidonJarvis.getVoice();
        if (engineSelect && window.PoseidonJarvis.getVoiceEngine) engineSelect.value = window.PoseidonJarvis.getVoiceEngine();
        if (modelSelect  && window.PoseidonJarvis.getTextModel)   modelSelect.value  = window.PoseidonJarvis.getTextModel();
      }
      block.querySelector('#pe-save-key').onclick = () => {
        if (window.PoseidonJarvis) {
          window.PoseidonJarvis.setApiKey(keyInput.value.trim());
          window.PoseidonJarvis.setVoice(voiceSelect.value);
          if (engineSelect && window.PoseidonJarvis.setVoiceEngine) window.PoseidonJarvis.setVoiceEngine(engineSelect.value);
          if (modelSelect  && window.PoseidonJarvis.setTextModel)   window.PoseidonJarvis.setTextModel(modelSelect.value);
          const st = block.querySelector('#pe-key-status');
          st.innerHTML = `<span class="text-teal-400">✓ Saved locally.</span>`;
          setTimeout(() => (st.innerHTML = ''), 3500);
        }
      };
      // ─── Tavily fallback key wiring ─────────────────────────────
      const tavilyInput = block.querySelector('#pe-tavily-key');
      try {
        const existing = localStorage.getItem('poseidon_tavily_api_key') || '';
        if (existing) tavilyInput.value = existing;
      } catch (_) {}
      block.querySelector('#pe-save-tavily').onclick = () => {
        const st = block.querySelector('#pe-tavily-status');
        const v = (tavilyInput.value || '').trim();
        try {
          if (v) localStorage.setItem('poseidon_tavily_api_key', v);
          else localStorage.removeItem('poseidon_tavily_api_key');
          st.innerHTML = v
            ? `<span class="text-teal-400">✓ Tavily key saved locally.</span>`
            : `<span class="text-zinc-400">Tavily key cleared.</span>`;
        } catch (e) {
          st.innerHTML = `<span class="text-rose-400">✗ ${e.message}</span>`;
        }
        setTimeout(() => (st.innerHTML = ''), 4000);
      };
      block.querySelector('#pe-test-tavily').onclick = async () => {
        const st = block.querySelector('#pe-tavily-status');
        st.innerHTML = `<span class="text-amber-400">Testing…</span>`;
        try {
          const key = (tavilyInput.value || '').trim();
          if (!key) throw new Error('No Tavily key provided');
          const r = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key, query: 'CTI Group hospitality recruitment', max_results: 1, include_answer: false })
          });
          if (r.ok) st.innerHTML = `<span class="text-teal-400">✓ Tavily key is valid.</span>`;
          else { const t = await r.text(); st.innerHTML = `<span class="text-rose-400">✗ ${r.status}: ${t.slice(0,160)}</span>`; }
        } catch (e) {
          st.innerHTML = `<span class="text-rose-400">✗ ${e.message}</span>`;
        }
      };

      block.querySelector('#pe-test-key').onclick = async () => {
        const st = block.querySelector('#pe-key-status');
        st.innerHTML = `<span class="text-amber-400">Testing…</span>`;
        try {
          const key = keyInput.value.trim();
          if (!key) throw new Error('No key provided');
          const r = await fetch('https://api.x.ai/v1/models', {
            headers: { 'Authorization': 'Bearer ' + key }
          });
          if (r.ok) st.innerHTML = `<span class="text-teal-400">✓ Key is valid.</span>`;
          else st.innerHTML = `<span class="text-rose-400">✗ ${r.status} ${r.statusText}</span>`;
        } catch (e) {
          st.innerHTML = `<span class="text-rose-400">✗ ${e.message}</span>`;
        }
      };
      return true;
    };

    // Observer: inject once settings page renders
    if (!injectSettings()) {
      const obs = new MutationObserver(() => { if (injectSettings()) obs.disconnect(); });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { injectSettings(); obs.disconnect(); }, 5000);
    }
  }
})();
