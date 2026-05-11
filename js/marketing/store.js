/* Marketing — localStorage CRUD store.
   Five collections: campaigns, calendar, channels, leads, sponsors, settings.
   On first load, seeds demo rows clearly labeled "sample data, replace via Edit". */
(function (root) {
  'use strict';

  var KEYS = {
    campaigns: 'poseidon-mkt-campaigns',
    calendar:  'poseidon-mkt-calendar',
    channels:  'poseidon-mkt-channels',
    leads:     'poseidon-mkt-leads',
    sponsors:  'poseidon-mkt-sponsors',
    seeded:    'poseidon-mkt-seeded-v1'
  };

  function load(k, defaultVal) {
    try {
      var raw = localStorage.getItem(KEYS[k]);
      if (raw == null) return defaultVal == null ? [] : defaultVal;
      return JSON.parse(raw);
    } catch (e) { return defaultVal == null ? [] : defaultVal; }
  }

  function save(k, val) {
    try { localStorage.setItem(KEYS[k], JSON.stringify(val)); } catch (e) {}
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function seedIfNeeded() {
    if (localStorage.getItem(KEYS.seeded)) return;

    save('campaigns', [
      { id: uid(), name: '[SAMPLE] Cruise recruitment Q2', owner: 'GHR', division: 'CTI Group', status: 'active', budget: 12000, spend: 4250, audience: 'Cruise candidates - Indonesia/Thailand', kpi: 'placements', tag: 'sample' },
      { id: uid(), name: '[SAMPLE] J-1 sourcing Spring',  owner: 'GHR', division: 'GHR',        status: 'active', budget: 8000,  spend: 1850, audience: 'University juniors/seniors - Thailand', kpi: 'apps_submitted', tag: 'sample' },
      { id: uid(), name: '[SAMPLE] UNO uniform launch',   owner: 'UNO', division: 'UNO',        status: 'draft',  budget: 5000,  spend: 0,    audience: 'Cruise lines + maritime ops', kpi: 'orders', tag: 'sample' },
      { id: uid(), name: '[SAMPLE] Baron summer promo',   owner: 'BAR', division: 'Baron',      status: 'paused', budget: 3000,  spend: 950,  audience: 'Yacht & charter agencies', kpi: 'orders', tag: 'sample' }
    ]);

    save('sponsors', [
      { id: uid(), partner: 'Alliance Abroad', campaign: 'Joint J-1 Spring 2026', deliverables: 'Co-branded landing + 2 webinars', status: 'planning',  deadline: '2026-06-15', owner: 'GHR', tag: 'sample' },
      { id: uid(), partner: 'CIEE',            campaign: 'BridgeUSA Hospitality', deliverables: 'Email blast + sponsor email',     status: 'active',    deadline: '2026-05-30', owner: 'GHR', tag: 'sample' },
      { id: uid(), partner: 'Greenheart',      campaign: 'Cultural Bridge 2026',  deliverables: 'Sponsor podcast guest spot',      status: 'committed', deadline: '2026-07-01', owner: 'GHR', tag: 'sample' }
    ]);

    save('calendar', []);
    save('channels', []);
    save('leads', []);
    localStorage.setItem(KEYS.seeded, '1');
  }

  function add(coll, item) {
    var arr = load(coll);
    item.id = item.id || uid();
    arr.push(item);
    save(coll, arr);
    return item;
  }

  function update(coll, id, patch) {
    var arr = load(coll);
    var i = arr.findIndex(function (x) { return x.id === id; });
    if (i === -1) return null;
    arr[i] = Object.assign({}, arr[i], patch, { id: id });
    save(coll, arr);
    return arr[i];
  }

  function remove(coll, id) {
    var arr = load(coll).filter(function (x) { return x.id !== id; });
    save(coll, arr);
  }

  function list(coll) { return load(coll); }

  function clearAll() {
    Object.values(KEYS).forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  }

  root.MarketingStore = {
    seedIfNeeded: seedIfNeeded,
    add: add, update: update, remove: remove, list: list,
    clearAll: clearAll, KEYS: KEYS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarketingStore;
})(typeof window !== 'undefined' ? window : globalThis);
