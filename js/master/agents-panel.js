/* Master Agents panel — reads data/jarvis-skills/index.json and renders cards. */
(function (root) {
  'use strict';

  function fetchIndex() {
    return fetch('data/jarvis-skills/index.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function card(d) {
    var color = d.color || 'sky';
    return ''
      + '<div class="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-5 border-l-4 border-l-' + color + '-500">'
      +   '<div class="flex items-center justify-between mb-3">'
      +     '<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">' + esc(d.id) + '</p>'
      +     '<span class="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">' + esc(d.confidentiality || 'internal') + '</span>'
      +   '</div>'
      +   '<h3 class="text-base font-semibold text-zinc-100">' + esc(d.displayName || d.id) + '</h3>'
      +   '<p class="text-sm text-zinc-400 mt-2 leading-relaxed">' + esc(d.summary || '') + '</p>'
      +   '<div class="mt-3 flex items-center gap-3 text-xs text-zinc-500">'
      +     '<span>↻ ' + esc(d.refreshFrequency || '—') + '</span>'
      +     '<span>· ' + esc(d.owner || '—') + '</span>'
      +     (d.partitionScope ? '<span>· scope: ' + esc(d.partitionScope) + '</span>' : '')
      +   '</div>'
      +   '<div class="mt-3 inline-flex items-center gap-2 text-xs">'
      +     '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>'
      +     '<span class="text-zinc-400">read-only · status display only (v2: manual triggers)</span>'
      +   '</div>'
      + '</div>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function render(host) {
    if (!host) return;
    host.innerHTML = '<p class="text-sm text-zinc-500">Loading agents…</p>';
    fetchIndex().then(function (idx) {
      if (!idx || !Array.isArray(idx.domains)) {
        host.innerHTML = '<p class="text-sm text-rose-300">Could not load data/jarvis-skills/index.json.</p>';
        return;
      }
      host.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">'
        + idx.domains.map(card).join('') + '</div>';
    });
  }

  root.MasterAgentsPanel = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
