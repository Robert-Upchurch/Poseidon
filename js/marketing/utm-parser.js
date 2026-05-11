/* Marketing — UTM / lead-source CSV parser.
   Expected columns (case-insensitive, comma-separated):
     Lead_Source, Lead_Source_Detail, Lead_Cost, Lead_Date, Lead_Status
   Returns { rows, errors, rollup: [{source, detail, count, cost, costPerLead}] }. */
(function (root) {
  'use strict';

  var REQUIRED_COLS = ['lead_source', 'lead_source_detail', 'lead_cost', 'lead_date', 'lead_status'];

  function parseLine(line) {
    /* tiny CSV parser — handles quoted commas */
    var out = []; var cur = ''; var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else { cur += ch; }
      }
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }

  function parse(text) {
    if (typeof text !== 'string' || !text.length) {
      return { rows: [], errors: ['empty input'], rollup: [] };
    }
    var lines = text.replace(/\r\n/g, '\n').split('\n').filter(function (l) { return l.length > 0; });
    if (lines.length < 2) return { rows: [], errors: ['header + at least 1 data row required'], rollup: [] };

    var headers = parseLine(lines[0]).map(function (h) { return h.toLowerCase(); });
    var missing = REQUIRED_COLS.filter(function (c) { return headers.indexOf(c) === -1; });
    if (missing.length) {
      return {
        rows: [], errors: ['missing required columns: ' + missing.join(', ')], rollup: []
      };
    }

    var idx = {};
    REQUIRED_COLS.forEach(function (c) { idx[c] = headers.indexOf(c); });

    var rows = [];
    var errors = [];
    for (var r = 1; r < lines.length; r++) {
      var cols = parseLine(lines[r]);
      if (cols.length !== headers.length) {
        errors.push('row ' + (r + 1) + ': column count mismatch');
        continue;
      }
      var rec = {
        source:  cols[idx.lead_source]        || '',
        detail:  cols[idx.lead_source_detail] || '',
        cost:    parseFloat(cols[idx.lead_cost]) || 0,
        date:    cols[idx.lead_date]          || '',
        status:  cols[idx.lead_status]        || ''
      };
      if (!rec.source) errors.push('row ' + (r + 1) + ': missing Lead_Source');
      rows.push(rec);
    }

    /* roll up by (source, detail) */
    var bag = {};
    rows.forEach(function (rec) {
      var key = rec.source + '||' + rec.detail;
      if (!bag[key]) bag[key] = { source: rec.source, detail: rec.detail, count: 0, cost: 0 };
      bag[key].count += 1;
      bag[key].cost += rec.cost;
    });
    var rollup = Object.keys(bag).map(function (k) {
      var b = bag[k];
      b.costPerLead = b.count ? (b.cost / b.count) : null;
      return b;
    }).sort(function (a, b) { return b.count - a.count; });

    return { rows: rows, errors: errors, rollup: rollup };
  }

  root.MarketingUTMParser = { parse: parse, REQUIRED_COLS: REQUIRED_COLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarketingUTMParser;
})(typeof window !== 'undefined' ? window : globalThis);
