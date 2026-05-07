/* ═══════════════════════════════════════════════════════════════════
   CTI MEDIA PLAYER — shared module (created 2026-05-06)

   Replaces the byte-identical inline player that lived in both
   poseidon-dashboard-v6.html and j1-system-dashboard.html. Now a single
   source of truth, loaded as <script src="js/poseidon-modules/media-player.js" defer>
   on every CTI Group dashboard (V6, J1 System, Tracker, J1 Housing
   Finder, Upchurch Financial).

   What it does:
     · Auto-injects the player bar HTML into <body> on load (if not
       already present). Bar is hidden by default — use playerOpen() to
       reveal.
     · Exposes the same global functions the existing markup expects:
       playerToggle, playerPrev, playerNext, playerSeek, playerMute,
       playerSetVolume, playerClose, playerOpen, loadPlayerTrack.
     · Stays compatible with the Tailwind classes the V6 + J1 markup
       was already using (the inline copy is removed in the same PR).
     · Hidden on print.
     · Cross-dashboard: same widget on every page; Jarvis's existing
       play_media / pause_media / stop_media tools find the <audio>
       element by id ('player-audio') and operate on it.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__ctiMediaPlayerLoaded) return;
  window.__ctiMediaPlayerLoaded = true;

  // ── State ────────────────────────────────────────────────────────
  let playerAudio = null;
  let playerPlaying = false;
  let playerQueue = [];
  let playerIdx = 0;

  // ── Bar HTML — Tailwind-classed (matches what V6 + J1 had) ──────
  const BAR_HTML = `
<div id="media-player-bar" class="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/95 border-t border-zinc-800 backdrop-blur-xl z-[999] px-4 hidden">
    <div class="flex items-center h-full gap-3">
        <div class="flex items-center gap-2 min-w-[160px] max-w-[220px]">
            <div id="player-icon" class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-sm shrink-0">🎙️</div>
            <div class="min-w-0"><div id="player-title" class="text-xs font-medium text-zinc-300 truncate">No track</div><div id="player-subtitle" class="text-[10px] text-zinc-600 truncate">—</div></div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <button onclick="playerPrev()" class="text-zinc-500 hover:text-zinc-300 text-sm">⏮</button>
            <button id="player-play-btn" onclick="playerToggle()" class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm hover:bg-indigo-600 transition-colors">▶</button>
            <button onclick="playerNext()" class="text-zinc-500 hover:text-zinc-300 text-sm">⏭</button>
        </div>
        <div class="flex-1 flex items-center gap-2">
            <span id="player-current-time" class="text-[10px] font-mono text-zinc-600 min-w-[32px] text-right">0:00</span>
            <div id="player-progress-container" class="flex-1 h-1 bg-zinc-800 rounded cursor-pointer relative" onclick="playerSeek(event)">
                <div id="player-progress" class="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded transition-[width] duration-100" style="width:0%"></div>
            </div>
            <span id="player-duration" class="text-[10px] font-mono text-zinc-600 min-w-[32px]">0:00</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="playerMute()" id="player-vol-icon" class="text-zinc-500 hover:text-zinc-300 text-sm">🔊</button>
            <input type="range" id="player-volume" min="0" max="100" value="80" class="w-16 accent-indigo-500" oninput="playerSetVolume(this.value)">
        </div>
        <button onclick="playerClose()" class="text-zinc-600 hover:text-zinc-400 text-sm">✕</button>
    </div>
    <audio id="player-audio" preload="metadata"></audio>
</div>
`;

  // ── Print rule + minimal CSS scoped (compatible with non-Tailwind hosts like Upchurch) ──
  const CSS = `
@media print { #media-player-bar { display:none !important; } }
/* Fallback styling for hosts that don't load Tailwind (e.g., Upchurch dashboard).
   When Tailwind is present these are overridden by its utility classes. */
#media-player-bar:not(.hidden) { display:block; }
#media-player-bar.hidden { display:none !important; }
`;

  function injectStyle() {
    if (document.getElementById('cti-media-player-css')) return;
    const s = document.createElement('style');
    s.id = 'cti-media-player-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureBar() {
    if (document.getElementById('media-player-bar')) return; // already in DOM (legacy or re-loaded)
    injectStyle();
    const wrap = document.createElement('div');
    wrap.innerHTML = BAR_HTML.trim();
    const bar = wrap.firstElementChild;
    if (bar) document.body.appendChild(bar);
  }

  // ── Tiny DOM helper (avoid colliding with host-page $) ──────────
  function el(id) { return document.getElementById(id); }

  // ── Public functions ────────────────────────────────────────────
  window.playerToggle = function () {
    if (!playerAudio) return;
    if (playerPlaying) { playerAudio.pause(); playerPlaying = false; }
    else { playerAudio.play(); playerPlaying = true; }
    updatePlayerBtn();
  };

  function updatePlayerBtn() {
    const btn = el('player-play-btn');
    if (btn) btn.textContent = playerPlaying ? '⏸' : '▶';
  }

  window.playerPrev = function () { if (playerIdx > 0) { playerIdx--; loadPlayerTrack(); } };
  window.playerNext = function () { if (playerIdx < playerQueue.length - 1) { playerIdx++; loadPlayerTrack(); } };

  window.loadPlayerTrack = function () {
    if (!playerQueue.length) return;
    const track = playerQueue[playerIdx];
    const t = el('player-title');     if (t) t.textContent = track.title || 'Track';
    const s = el('player-subtitle');  if (s) s.textContent = track.artist || '';
    if (track.url && playerAudio) {
      try { playerAudio.src = track.url; playerAudio.load(); } catch (_) {}
    }
  };

  window.playerSeek = function (e) {
    if (!playerAudio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (playerAudio.duration) playerAudio.currentTime = pct * playerAudio.duration;
  };

  window.playerMute = function () {
    if (!playerAudio) return;
    playerAudio.muted = !playerAudio.muted;
    const icon = el('player-vol-icon');
    if (icon) icon.textContent = playerAudio.muted ? '🔇' : '🔊';
  };

  window.playerSetVolume = function (v) {
    if (playerAudio) playerAudio.volume = (v|0) / 100;
  };

  window.playerClose = function () {
    if (playerAudio) { try { playerAudio.pause(); } catch (_) {} }
    playerPlaying = false;
    const bar = el('media-player-bar');
    if (bar) bar.classList.add('hidden');
  };

  /**
   * Reveal the bar and (optionally) load + play a track.
   * @param {Object} opts
   * @param {string} opts.url   media URL
   * @param {string} opts.title display title
   * @param {string} opts.artist subtitle
   * @param {boolean} opts.autoplay default true
   */
  window.playerOpen = function (opts = {}) {
    ensureBar();
    const bar = el('media-player-bar');
    if (bar) bar.classList.remove('hidden');
    playerAudio = el('player-audio');
    if (!playerAudio) return;
    if (opts.url) {
      playerQueue = [{ url: opts.url, title: opts.title || 'Track', artist: opts.artist || '' }];
      playerIdx = 0;
      loadPlayerTrack();
      if (opts.autoplay !== false) {
        playerAudio.play().then(function () { playerPlaying = true; updatePlayerBtn(); }).catch(function () {});
      }
    }
  };

  // ── Audio time-tracking → progress bar + duration label ─────────
  function bindAudio() {
    playerAudio = el('player-audio');
    if (!playerAudio) return;
    playerAudio.addEventListener('timeupdate', function () {
      const ct = el('player-current-time');
      const pg = el('player-progress');
      if (ct) ct.textContent = fmtTime(playerAudio.currentTime);
      if (pg && playerAudio.duration) pg.style.width = ((playerAudio.currentTime / playerAudio.duration) * 100).toFixed(2) + '%';
    });
    playerAudio.addEventListener('loadedmetadata', function () {
      const dur = el('player-duration');
      if (dur) dur.textContent = fmtTime(playerAudio.duration);
    });
    playerAudio.addEventListener('ended', function () {
      playerPlaying = false;
      updatePlayerBtn();
      if (playerIdx < playerQueue.length - 1) { playerIdx++; loadPlayerTrack(); playerAudio.play(); }
    });
  }
  function fmtTime(s) {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    const m = Math.floor(s / 60);
    const r = String(s % 60).padStart(2, '0');
    return m + ':' + r;
  }

  function init() {
    ensureBar();
    bindAudio();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
