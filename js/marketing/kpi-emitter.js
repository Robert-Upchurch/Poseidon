/* Marketing — KPI emitter.
   Composes /api/kpi-summary?scope=marketing per docs/INTEGRATION-CONTRACT.md §3.
   Required IDs: active_campaigns, mtd_ad_spend_usd, mtd_leads, blended_cac_usd, top_channel.
   Reads from localStorage via MarketingStore — never from raw CRM (partition_safe:true). */
(function (root) {
  'use strict';

  var REQUIRED = [
    { id: 'active_campaigns',  label: 'Active campaigns', unit: 'count', drilldown: 'cti-marketing-dashboard.html#campaigns' },
    { id: 'mtd_ad_spend_usd',  label: 'MTD ad spend',     unit: 'USD',   drilldown: 'cti-marketing-dashboard.html#channels' },
    { id: 'mtd_leads',         label: 'MTD leads',        unit: 'count', drilldown: 'cti-marketing-dashboard.html#attribution' },
    { id: 'blended_cac_usd',   label: 'Blended CAC',      unit: 'USD',   drilldown: 'cti-marketing-dashboard.html#roi' },
    { id: 'top_channel',       label: 'Top channel',      unit: 'count', drilldown: 'cti-marketing-dashboard.html#channels' }
  ];

  function thisMonthBounds() {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: start, end: now };
  }

  function inMonth(dateStr) {
    if (!dateStr) return false;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    var b = thisMonthBounds();
    return d >= b.start && d <= b.end;
  }

  function build(input) {
    input = input || {};
    var nowIso = new Date().toISOString();
    var freshUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    var campaigns = Array.isArray(input.campaigns) ? input.campaigns
                  : (root.MarketingStore ? root.MarketingStore.list('campaigns') : []);
    var channels  = Array.isArray(input.channels)  ? input.channels
                  : (root.MarketingStore ? root.MarketingStore.list('channels')  : []);
    var leads     = Array.isArray(input.leads)     ? input.leads
                  : (root.MarketingStore ? root.MarketingStore.list('leads')     : []);

    var activeCount = campaigns.filter(function (c) { return c.status === 'active'; }).length;

    var mtdSpend = 0;
    var seenSpend = false;
    channels.forEach(function (c) {
      if (inMonth(c.date)) { mtdSpend += Number(c.spend || 0); seenSpend = true; }
    });
    if (!seenSpend) {
      // fall back to campaign-tracked spend MTD if no per-channel rows
      campaigns.forEach(function (c) {
        if (c.spend) { mtdSpend += Number(c.spend || 0); seenSpend = true; }
      });
    }

    var mtdLeads = 0;
    var seenLeads = false;
    leads.forEach(function (l) {
      if (inMonth(l.lead_date || l.date)) { mtdLeads += 1; seenLeads = true; }
    });

    var blendedCAC = null;
    if (seenSpend && seenLeads && mtdLeads > 0) blendedCAC = mtdSpend / mtdLeads;

    var topChannel = null;
    if (channels.length) {
      var byChannel = {};
      channels.forEach(function (c) {
        if (!inMonth(c.date)) return;
        var k = c.channel || 'unknown';
        byChannel[k] = (byChannel[k] || 0) + Number(c.spend || 0);
      });
      var max = -1;
      Object.keys(byChannel).forEach(function (k) {
        if (byChannel[k] > max) { max = byChannel[k]; topChannel = k; }
      });
    }

    var values = {
      active_campaigns: activeCount,
      mtd_ad_spend_usd: seenSpend ? mtdSpend : null,
      mtd_leads:        seenLeads ? mtdLeads : null,
      blended_cac_usd:  blendedCAC,
      top_channel:      null /* label encodes the channel name; value stays null per contract enum constraints */
    };

    var kpis = REQUIRED.map(function (k) {
      var v = values[k.id];
      var entry = {
        id: k.id,
        label: k.label + (k.id === 'top_channel' && topChannel ? ': ' + topChannel : ''),
        value: v == null ? null : v,
        unit: k.unit,
        as_of: nowIso,
        drilldown: k.drilldown
      };
      return entry;
    });

    var alerts = [];
    if (!seenSpend && !seenLeads) {
      alerts.push({
        id: 'no-marketing-data',
        severity: 'info',
        message: 'No marketing data entered yet — see Channels and Lead Attribution sections',
        link: 'cti-marketing-dashboard.html#channels'
      });
    }

    return {
      scope: 'marketing',
      captured_at: nowIso,
      fresh_until: freshUntil,
      source_state: { primary: 'live', fallback_from: null },
      kpis: kpis,
      alerts: alerts,
      links: { deep: 'cti-marketing-dashboard.html', refresh_now: '/api/kpi-summary?scope=marketing&_t=now' },
      meta: { version: '1.0', owner_agent: 'cti-marketing-dashboard', partition_safe: true }
    };
  }

  root.MarketingKPIEmitter = { build: build, REQUIRED: REQUIRED };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarketingKPIEmitter;
})(typeof window !== 'undefined' ? window : globalThis);
