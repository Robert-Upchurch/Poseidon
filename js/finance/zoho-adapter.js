/* Finance — Zoho Books adapter.
   Today: reads config/zoho-books-snapshot.json (already in repo, refreshed via Cowork / Zoho MCP).
   Future: same shape served live by Cloudflare Worker at ${workerUrl}/zoho/* once deployed. */
(function (root) {
  'use strict';

  var SNAPSHOT_URL = 'config/zoho-books-snapshot.json';
  var STATE = { snapshot: null, loadedAt: null, error: null };

  function loadSnapshot(force) {
    if (STATE.snapshot && !force) return Promise.resolve(STATE.snapshot);
    var url = SNAPSHOT_URL + (force ? ('?_t=' + Date.now()) : '');
    return fetch(url, { cache: force ? 'no-store' : 'default' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        STATE.snapshot = j;
        STATE.loadedAt = new Date();
        STATE.error = null;
        return j;
      })
      .catch(function (e) {
        STATE.error = String(e.message || e);
        return null;
      });
  }

  function snapshot() { return STATE.snapshot; }
  function loadedAt() { return STATE.loadedAt; }
  function error()    { return STATE.error; }

  function bankBalances() {
    var s = STATE.snapshot;
    if (!s || !Array.isArray(s.bank_accounts)) return [];
    return s.bank_accounts.map(function (a) {
      return {
        name: a.account_name || a.name || 'Account',
        last4: (a.account_number || '').slice(-4),
        balance: typeof a.balance === 'number' ? a.balance : null
      };
    });
  }

  function cashTotal() {
    var arr = bankBalances();
    if (!arr.length) return null;
    var sum = arr.reduce(function (a, b) { return a + (typeof b.balance === 'number' ? b.balance : 0); }, 0);
    return sum;
  }

  function arTotals() {
    var s = STATE.snapshot;
    var br = s && s.ar_status_breakdown ? s.ar_status_breakdown : {};
    var total = (typeof s?.kpis?.ar_outstanding === 'number') ? s.kpis.ar_outstanding : null;
    var aging90 = br['90_plus_days'] != null ? br['90_plus_days']
                : br['90+'] != null ? br['90+']
                : null;
    return { total: total, aging90Plus: aging90, breakdown: br };
  }

  function apTotals() {
    var s = STATE.snapshot;
    return {
      total: (s && s.kpis && typeof s.kpis.ap_outstanding === 'number') ? s.kpis.ap_outstanding : null
    };
  }

  function revenueTotals() {
    var s = STATE.snapshot;
    var k = s && s.kpis ? s.kpis : {};
    return {
      mtd: typeof k.mtd_revenue === 'number' ? k.mtd_revenue : null,
      ytd: typeof k.ytd_revenue === 'number' ? k.ytd_revenue : null
    };
  }

  function recentInvoices(limit) {
    var s = STATE.snapshot;
    var arr = (s && Array.isArray(s.recent_invoices)) ? s.recent_invoices : [];
    return arr.slice(0, limit || 10);
  }

  function topOverdue(limit) {
    var s = STATE.snapshot;
    var arr = (s && Array.isArray(s.top_overdue_invoices)) ? s.top_overdue_invoices : [];
    return arr.slice(0, limit || 10);
  }

  function branchRevenue() {
    var s = STATE.snapshot;
    return (s && Array.isArray(s.branch_revenue)) ? s.branch_revenue : [];
  }

  function capturedAt() {
    var s = STATE.snapshot;
    return (s && s._meta && s._meta.captured_at) ? s._meta.captured_at : (STATE.loadedAt ? STATE.loadedAt.toISOString() : null);
  }

  root.ZohoAdapter = {
    load: loadSnapshot,
    snapshot: snapshot,
    loadedAt: loadedAt,
    error: error,
    bankBalances: bankBalances,
    cashTotal: cashTotal,
    arTotals: arTotals,
    apTotals: apTotals,
    revenueTotals: revenueTotals,
    recentInvoices: recentInvoices,
    topOverdue: topOverdue,
    branchRevenue: branchRevenue,
    capturedAt: capturedAt
  };

  // CommonJS export for node --check / tests
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZohoAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
