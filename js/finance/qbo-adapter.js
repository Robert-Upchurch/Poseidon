/* Finance — QBO adapter (stub).
   Per ASSUMPTIONS.md §Q14: no QBO connector is currently available in this
   Claude environment, and no realm ID / refresh token exists in any repo.
   This module exposes the clean interface a future QBO route would fill,
   so the dashboard can render "no QBO" status without code changes when
   the live connector lands. */
(function (root) {
  'use strict';

  function isSupported() {
    return false; // flip to true once Worker /qbo/* routes are deployed AND a realm is configured
  }

  function companyInfo() {
    return Promise.resolve({
      supported: false,
      reason: 'no-qbo-connector-configured',
      hint: 'See docs/CLOUDFLARE-WORKER-CHANGELOG.md for the QBO route plan and required secrets.'
    });
  }

  function balances() {
    return Promise.resolve({ supported: false, reason: 'no-qbo-connector-configured', accounts: [] });
  }

  function transactions(_params) {
    return Promise.resolve({ supported: false, reason: 'no-qbo-connector-configured', transactions: [] });
  }

  function invoices(_params) {
    return Promise.resolve({ supported: false, reason: 'no-qbo-connector-configured', invoices: [] });
  }

  root.QBOAdapter = {
    isSupported: isSupported,
    companyInfo: companyInfo,
    balances: balances,
    transactions: transactions,
    invoices: invoices
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.QBOAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
