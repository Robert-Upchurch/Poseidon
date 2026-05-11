/* Poseidon shared — KPI client.
   Reads /api/kpi-summary per docs/INTEGRATION-CONTRACT.md.
   Caches in localStorage for 15 min by default (server can override via fresh_until).
   Returns null when Worker URL or token is missing (caller renders skeleton). */
(function (root) {
  'use strict';

  var WORKER_KEY = 'poseidon-worker-url';
  var TOKEN_KEY  = 'poseidon-dashboard-token';
  var DEFAULT_TTL_MS = 15 * 60 * 1000;
  var CONFIG_URL = 'config/worker.json';
  var configSeeded = false;

  function cfg() {
    var url = '';
    var tok = '';
    try {
      url = localStorage.getItem(WORKER_KEY) || '';
      tok = localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {}
    return { url: url.replace(/\/+$/, ''), token: tok };
  }

  /* Auto-seed the Worker URL from config/worker.json if localStorage is empty.
     Runs once per page load. Never overwrites a value the user already set. */
  function seedFromConfig() {
    if (configSeeded) return Promise.resolve();
    configSeeded = true;
    return fetch(CONFIG_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.worker_url) return;
        try {
          if (!localStorage.getItem(WORKER_KEY)) {
            localStorage.setItem(WORKER_KEY, j.worker_url);
          }
        } catch (e) {}
      })
      .catch(function () { /* offline — caller renders skeleton */ });
  }

  function cacheKey(scope) { return 'poseidon-kpi:' + scope; }

  function readCache(scope) {
    try {
      var raw = localStorage.getItem(cacheKey(scope));
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.expires || c.expires < Date.now()) return null;
      return c.payload;
    } catch (e) { return null; }
  }

  function writeCache(scope, payload) {
    try {
      var freshUntil = payload && payload.fresh_until ? Date.parse(payload.fresh_until) : NaN;
      var expires = isFinite(freshUntil) ? freshUntil : (Date.now() + DEFAULT_TTL_MS);
      localStorage.setItem(cacheKey(scope), JSON.stringify({ expires: expires, payload: payload }));
    } catch (e) {}
  }

  function summary(scope, opts) {
    opts = opts || {};
    return seedFromConfig().then(function () {
      var c = cfg();
      if (!c.url) {
        return { ok: false, reason: 'no-worker-url', payload: null };
      }
      if (!c.token) {
        return { ok: false, reason: 'no-token', payload: null,
                 hint: 'Open Settings → paste your DASHBOARD_TOKEN' };
      }
      if (!opts.force) {
        var cached = readCache(scope);
        if (cached) return { ok: true, fromCache: true, payload: cached };
      }
      var u = c.url + '/api/kpi-summary?scope=' + encodeURIComponent(scope);
      if (opts.since) u += '&since=' + encodeURIComponent(opts.since);
      if (opts.partition) u += '&partition=' + encodeURIComponent(opts.partition);
      return fetchWithRetry(u, c.token).then(function (res) {
        if (res.ok) writeCache(scope, res.payload);
        return res;
      });
    });
  }

  function fetchWithRetry(url, token) {
    return doFetch(url, token).then(function (r) {
      if (r.status === 429) {
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(doFetch(url, token)); }, 1000);
        });
      }
      return r;
    }).then(toResult);
  }

  function doFetch(url, token) {
    return fetch(url, {
      method: 'GET',
      headers: { 'X-Dashboard-Token': token, 'Accept': 'application/json' },
      credentials: 'omit'
    }).catch(function (err) {
      return { _network: true, status: 0, _err: err };
    });
  }

  function toResult(resp) {
    if (resp._network) {
      return { ok: false, reason: 'network', payload: null, error: String(resp._err) };
    }
    if (!resp.ok) {
      return resp.json().then(function (body) {
        return { ok: false, reason: 'http-' + resp.status, payload: null, error: body };
      }, function () {
        return { ok: false, reason: 'http-' + resp.status, payload: null };
      });
    }
    return resp.json().then(function (body) {
      return { ok: true, fromCache: false, payload: body };
    });
  }

  function configure(url, token) {
    try {
      if (typeof url === 'string') localStorage.setItem(WORKER_KEY, url);
      if (typeof token === 'string') localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
  }

  function getConfig() { return cfg(); }

  /* Public: trigger the auto-seed manually (e.g. on dashboard init so Settings
     fields pre-fill before the user opens the Settings panel). */
  function init() { return seedFromConfig().then(cfg); }

  function clearCache() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('poseidon-kpi:') === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  root.KPIClient = {
    summary: summary,
    configure: configure,
    getConfig: getConfig,
    init: init,
    clearCache: clearCache
  };
})(typeof window !== 'undefined' ? window : globalThis);
