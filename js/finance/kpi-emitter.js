/* Finance — KPI emitter.
   Composes the /api/kpi-summary?scope=finance payload per docs/INTEGRATION-CONTRACT.md §3.
   Required IDs (must always be present, value:null if not yet wired):
     cash_total_usd, ar_total_usd, ar_aging_90_plus_usd, ap_total_usd,
     mtd_revenue_usd, ytd_revenue_usd, cash_runway_days
   Aggregate-only (partition_safe: true) — no customer/candidate-level fields. */
(function (root) {
  'use strict';

  var REQUIRED = [
    { id: 'cash_total_usd',          label: 'Cash total',         unit: 'USD',   drilldown: 'cti-financial-dashboard.html#cash' },
    { id: 'ar_total_usd',            label: 'AR total',           unit: 'USD',   drilldown: 'cti-financial-dashboard.html#invoicing' },
    { id: 'ar_aging_90_plus_usd',    label: 'AR aging 90+',       unit: 'USD',   drilldown: 'cti-financial-dashboard.html#invoicing' },
    { id: 'ap_total_usd',            label: 'AP total',           unit: 'USD',   drilldown: 'cti-financial-dashboard.html#bills' },
    { id: 'mtd_revenue_usd',         label: 'MTD revenue',        unit: 'USD',   drilldown: 'cti-financial-dashboard.html#snapshot' },
    { id: 'ytd_revenue_usd',         label: 'YTD revenue',        unit: 'USD',   drilldown: 'cti-financial-dashboard.html#snapshot' },
    { id: 'cash_runway_days',        label: 'Cash runway',        unit: 'days',  drilldown: 'cti-financial-dashboard.html#snapshot' }
  ];

  /* input: { zoho: ZohoAdapter, plaid: PlaidAdapterResult, qbo: QBOAdapterResult }
     each input piece is optional; emitter returns nulls for whatever is missing. */
  function build(input) {
    input = input || {};
    var now = new Date();
    var nowIso = now.toISOString();
    var freshUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    var z   = input.zoho || null;
    var pl  = input.plaid || null;
    var qbo = input.qbo || null;

    var cashTotal = null;
    var asOfCash  = null;
    if (pl && Array.isArray(pl.accounts) && pl.accounts.length) {
      cashTotal = sum(pl.accounts.map(function (a) { return a.balance_current; }));
      asOfCash = nowIso;
    } else if (z && typeof z.cashTotal === 'function') {
      cashTotal = z.cashTotal();
      asOfCash  = z.capturedAt ? z.capturedAt() : null;
    }

    var ar = (z && typeof z.arTotals === 'function') ? z.arTotals() : { total: null, aging90Plus: null };
    var ap = (z && typeof z.apTotals === 'function') ? z.apTotals() : { total: null };
    var rev = (z && typeof z.revenueTotals === 'function') ? z.revenueTotals() : { mtd: null, ytd: null };
    var asOfBooks = (z && typeof z.capturedAt === 'function') ? z.capturedAt() : null;

    var runway = null;
    if (typeof cashTotal === 'number' && typeof rev.mtd === 'number' && rev.mtd !== 0) {
      // rough: cash / monthly burn approximation — placeholder until expense burn modeled
      runway = Math.max(0, Math.round(cashTotal / Math.max(1, Math.abs(rev.mtd)) * 30));
    }

    var values = {
      cash_total_usd:        { value: cashTotal,         asOf: asOfCash },
      ar_total_usd:          { value: ar.total,          asOf: asOfBooks },
      ar_aging_90_plus_usd:  { value: ar.aging90Plus,    asOf: asOfBooks },
      ap_total_usd:          { value: ap.total,          asOf: asOfBooks },
      mtd_revenue_usd:       { value: rev.mtd,           asOf: asOfBooks },
      ytd_revenue_usd:       { value: rev.ytd,           asOf: asOfBooks },
      cash_runway_days:      { value: runway,            asOf: asOfBooks }
    };

    var kpis = REQUIRED.map(function (k) {
      var v = values[k.id];
      return {
        id: k.id,
        label: k.label,
        value: v && v.value != null ? v.value : null,
        unit: k.unit,
        as_of: v ? v.asOf : null,
        drilldown: k.drilldown
      };
    });

    var alerts = [];
    if (typeof ar.aging90Plus === 'number' && ar.aging90Plus > 50000) {
      alerts.push({
        id: 'ar_90_plus_high',
        severity: 'warning',
        message: 'AR 90+ days exceeds $50K — review collections',
        link: 'cti-financial-dashboard.html#invoicing'
      });
    }
    if (qbo && qbo.supported === false) {
      alerts.push({
        id: 'qbo_not_configured',
        severity: 'info',
        message: 'QBO connector not configured (see ASSUMPTIONS §Q14)',
        link: 'docs/ASSUMPTIONS.md'
      });
    }

    return {
      scope: 'finance',
      captured_at: nowIso,
      fresh_until: freshUntil,
      source_state: {
        primary: (z && z.snapshot && z.snapshot()) ? 'live' : 'snapshot',
        fallback_from: null
      },
      kpis: kpis,
      alerts: alerts,
      links: {
        deep: 'cti-financial-dashboard.html',
        refresh_now: '/api/kpi-summary?scope=finance&_t=now'
      },
      meta: {
        version: '1.0',
        owner_agent: 'cti-financial-dashboard',
        partition_safe: true
      }
    };
  }

  function sum(arr) {
    var s = 0; var seenNumber = false;
    for (var i = 0; i < arr.length; i++) {
      if (typeof arr[i] === 'number' && isFinite(arr[i])) { s += arr[i]; seenNumber = true; }
    }
    return seenNumber ? s : null;
  }

  root.FinanceKPIEmitter = { build: build, REQUIRED: REQUIRED };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FinanceKPIEmitter;
})(typeof window !== 'undefined' ? window : globalThis);
