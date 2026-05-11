/* Finance — Plaid adapter.
   Sandbox: returns deterministic mocked balances/transactions for UI rendering.
   Development / Production: calls ${workerUrl}/plaid/* routes once deployed.
   Environment selected in Settings (localStorage poseidon-plaid-env, default 'sandbox'). */
(function (root) {
  'use strict';

  var ENV_KEY = 'poseidon-plaid-env'; // 'sandbox' | 'development' | 'production'

  function env() {
    try { return localStorage.getItem(ENV_KEY) || 'sandbox'; } catch (e) { return 'sandbox'; }
  }

  function setEnv(v) {
    if (v !== 'sandbox' && v !== 'development' && v !== 'production') return;
    try { localStorage.setItem(ENV_KEY, v); } catch (e) {}
  }

  /* ── Sandbox mock data (clearly fake, drives UI states) ────────── */
  var SANDBOX_ACCOUNTS = [
    { item_id: 'sand-item-1', institution: 'Sandbox Bank', name: 'CTI Operating',  mask: '0001', type: 'depository', subtype: 'checking', balance_current: 92350.40, balance_available: 90000.00, iso_currency: 'USD' },
    { item_id: 'sand-item-1', institution: 'Sandbox Bank', name: 'CTI Reserve',    mask: '0002', type: 'depository', subtype: 'savings',  balance_current: 42500.00, balance_available: 42500.00, iso_currency: 'USD' },
    { item_id: 'sand-item-2', institution: 'Sandbox Bank', name: 'GHR Operating',  mask: '1001', type: 'depository', subtype: 'checking', balance_current: 18120.85, balance_available: 17890.85, iso_currency: 'USD' },
    { item_id: 'sand-item-3', institution: 'Sandbox Bank', name: 'Marine Travel',  mask: '2001', type: 'depository', subtype: 'checking', balance_current: 32030.00, balance_available: 31200.00, iso_currency: 'USD' }
  ];

  var SANDBOX_TX = [
    { account_mask: '0001', date: '2026-05-10', name: 'CARNIVAL UK INVOICE — March placement fees', amount: 14500.00, category: 'revenue' },
    { account_mask: '0001', date: '2026-05-09', name: 'GUSTO PAYROLL', amount: -8400.00, category: 'payroll' },
    { account_mask: '2001', date: '2026-05-08', name: 'DELTA AIR LINES', amount: -1850.00, category: 'travel' }
  ];

  function getBalances() {
    var e = env();
    if (e === 'sandbox') {
      return Promise.resolve({ env: e, fromMock: true, accounts: SANDBOX_ACCOUNTS.slice() });
    }
    if (!root.KPIClient) return Promise.resolve({ env: e, accounts: [], error: 'kpi-client-missing' });
    var cfg = root.KPIClient.getConfig();
    if (!cfg.url) return Promise.resolve({ env: e, accounts: [], error: 'worker-not-configured' });
    return fetch(cfg.url.replace(/\/+$/, '') + '/plaid/balance', {
      headers: { 'X-Dashboard-Token': cfg.token }
    }).then(function (r) { return r.ok ? r.json() : Promise.reject('http-' + r.status); })
      .then(function (j) { return { env: e, accounts: j.accounts || [] }; })
      .catch(function (err) { return { env: e, accounts: [], error: String(err) }; });
  }

  function getTransactions(opts) {
    opts = opts || {};
    var e = env();
    if (e === 'sandbox') {
      return Promise.resolve({ env: e, fromMock: true, transactions: SANDBOX_TX.slice() });
    }
    if (!root.KPIClient) return Promise.resolve({ env: e, transactions: [], error: 'kpi-client-missing' });
    var cfg = root.KPIClient.getConfig();
    if (!cfg.url) return Promise.resolve({ env: e, transactions: [], error: 'worker-not-configured' });
    var u = cfg.url.replace(/\/+$/, '') + '/plaid/transactions/sync' + (opts.cursor ? '?cursor=' + encodeURIComponent(opts.cursor) : '');
    return fetch(u, { headers: { 'X-Dashboard-Token': cfg.token } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject('http-' + r.status); })
      .then(function (j) { return { env: e, transactions: j.transactions || [], next_cursor: j.next_cursor || null }; })
      .catch(function (err) { return { env: e, transactions: [], error: String(err) }; });
  }

  function totalCash(accts) {
    if (!Array.isArray(accts)) return null;
    var sum = 0;
    accts.forEach(function (a) { if (typeof a.balance_current === 'number') sum += a.balance_current; });
    return sum;
  }

  root.PlaidAdapter = {
    env: env,
    setEnv: setEnv,
    getBalances: getBalances,
    getTransactions: getTransactions,
    totalCash: totalCash
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.PlaidAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
