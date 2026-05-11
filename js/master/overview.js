/* Master Overview pane — KPI roll-up tiles, populated from /api/kpi-summary?scope=master. */
(function (root) {
  'use strict';

  /* 11-tile master superset per INTEGRATION-CONTRACT.md §3.2 */
  var TILES = [
    { id: 'cash_total_usd',          label: 'Cash total',          unit: 'USD',   accent: 'emerald' },
    { id: 'ar_aging_90_plus_usd',    label: 'AR 90+ days',         unit: 'USD',   accent: 'rose' },
    { id: 'mtd_revenue_usd',         label: 'MTD revenue',         unit: 'USD',   accent: 'emerald' },
    { id: 'ytd_revenue_usd',         label: 'YTD revenue',         unit: 'USD',   accent: 'emerald' },
    { id: 'cruise_active_candidates',label: 'Cruise candidates',   unit: 'count', accent: 'sky' },
    { id: 'j1_active_candidates',    label: 'J-1 candidates',      unit: 'count', accent: 'indigo' },
    { id: 'j1_housing_beds_filled_pct', label: 'J-1 housing fill', unit: 'pct',   accent: 'indigo' },
    { id: 'active_campaigns',        label: 'Active campaigns',    unit: 'count', accent: 'fuchsia' },
    { id: 'mtd_ad_spend_usd',        label: 'MTD ad spend',        unit: 'USD',   accent: 'fuchsia' },
    { id: 'tasks_open',              label: 'Open tasks',          unit: 'count', accent: 'amber' },
    { id: 'health_pct',              label: 'System health',       unit: 'pct',   accent: 'sky' }
  ];

  function fmt(value, unit) {
    if (!root.Format) return value == null ? '—' : String(value);
    if (value == null) return '—';
    if (unit === 'USD')   return root.Format.fmtCompactUSD(value);
    if (unit === 'pct')   return root.Format.fmtPct(value, 0);
    if (unit === 'count') return root.Format.fmtInt(value);
    if (unit === 'days')  return root.Format.fmtDays(value);
    return String(value);
  }

  function tileTemplate(t) {
    return ''
      + '<div class="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-5 border-l-4 border-l-' + t.accent + '-500" data-tile="' + t.id + '">'
      +   '<p class="text-xs font-mono uppercase tracking-wider text-zinc-500">' + t.label + '</p>'
      +   '<p class="text-3xl font-bold text-zinc-100 mt-2" data-value>—</p>'
      +   '<p class="text-xs text-zinc-500 mt-1" data-as-of>not yet wired</p>'
      + '</div>';
  }

  function render(host) {
    if (!host) return;
    host.innerHTML = TILES.map(tileTemplate).join('');
  }

  function paintBanner(host, kind, msg) {
    var b = host.querySelector('[data-banner]');
    if (!b) return;
    b.className = 'mb-4 px-4 py-3 rounded-lg text-sm ' +
      (kind === 'error'
        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
        : 'bg-amber-500/10 border border-amber-500/30 text-amber-200');
    b.textContent = msg;
    b.classList.remove('hidden');
  }

  function hideBanner(host) {
    var b = host.querySelector('[data-banner]');
    if (b) b.classList.add('hidden');
  }

  function applyPayload(host, payload) {
    if (!payload || !Array.isArray(payload.kpis)) return;
    var byId = {};
    payload.kpis.forEach(function (k) { byId[k.id] = k; });
    TILES.forEach(function (t) {
      var tile = host.querySelector('[data-tile="' + t.id + '"]');
      if (!tile) return;
      var k = byId[t.id];
      var valEl = tile.querySelector('[data-value]');
      var asEl  = tile.querySelector('[data-as-of]');
      if (!k || k.value == null) {
        if (valEl) valEl.textContent = '—';
        if (asEl)  asEl.textContent  = 'not yet wired';
        tile.classList.add('opacity-70');
        return;
      }
      tile.classList.remove('opacity-70');
      if (valEl) valEl.textContent = fmt(k.value, t.unit);
      if (asEl)  asEl.textContent  = k.as_of ? ('as of ' + root.Format.fmtAgo(k.as_of)) : '';
    });
  }

  function refresh(host) {
    if (!host || !root.KPIClient) return Promise.resolve();
    return root.KPIClient.summary('master', { force: true }).then(function (res) {
      if (!res.ok) {
        var msg = res.reason === 'not-configured'
          ? 'Worker not configured — set URL + token in Settings'
          : 'Live feed unavailable (' + res.reason + ') — showing skeleton';
        paintBanner(host, res.reason === 'not-configured' ? 'warn' : 'error', msg);
        return;
      }
      hideBanner(host);
      applyPayload(host, res.payload);
    });
  }

  function init(host) {
    render(host);
    refresh(host);
  }

  root.MasterOverview = { init: init, refresh: refresh, TILES: TILES };
})(typeof window !== 'undefined' ? window : globalThis);
