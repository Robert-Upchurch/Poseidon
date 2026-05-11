/* Poseidon shared — number / date formatting helpers. */
(function (root) {
  'use strict';

  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  function fmtUSD(n) {
    if (!isNum(n)) return '—';
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function fmtCompactUSD(n) {
    if (!isNum(n)) return '—';
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(n);
    if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'K';
    return sign + '$' + abs.toFixed(0);
  }

  function fmtInt(n) {
    if (!isNum(n)) return '—';
    return Number(n).toLocaleString('en-US');
  }

  function fmtPct(n, digits) {
    if (!isNum(n)) return '—';
    var d = (typeof digits === 'number') ? digits : 1;
    return n.toFixed(d) + '%';
  }

  function fmtDays(n) {
    if (!isNum(n)) return '—';
    return Math.round(n) + (Math.abs(Math.round(n)) === 1 ? ' day' : ' days');
  }

  function fmtAgo(iso) {
    if (!iso) return '—';
    var t = Date.parse(iso);
    if (isNaN(t)) return '—';
    var diff = (Date.now() - t) / 1000;
    if (diff < 60)   return Math.round(diff) + 's ago';
    if (diff < 3600) return Math.round(diff / 60) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }

  root.Format = {
    fmtUSD: fmtUSD,
    fmtCompactUSD: fmtCompactUSD,
    fmtInt: fmtInt,
    fmtPct: fmtPct,
    fmtDays: fmtDays,
    fmtAgo: fmtAgo
  };
})(typeof window !== 'undefined' ? window : globalThis);
