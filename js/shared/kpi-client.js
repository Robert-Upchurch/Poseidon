/* Poseidon shared — KPI client.
   Reads /api/kpi-summary per docs/INTEGRATION-CONTRACT.md.
   Caches in localStorage for 15 min by default (server can override via fresh_until).
   Returns null when Worker URL or token is missing (caller renders skeleton). */
(function (root) {
  'use strict';

  var WORKER_KEY = 'poseidon-worker-url';
  var TOKEN_KEY  = 'poseidon-dashboard-token';
  var DEFAULT_TTL_MS = 15 * 60 * 1000;

  function cfg() {
    var url = '';
    var tok = '';
    try {
      url = localStorage.getItem(WORKER_KEY) || '';
      tok = localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {}
    return { url: url.replace(/\/+$/, ''), token: tok };
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
    var c = cfg();
    if (!c.url || !c.token) {
      return Promise.resolve({ ok: false, reason: 'not-configured', payload: null });
    }
    if (!opts.force) {
      var cached = readCache(scope);
      if (cached) return Promise.resolve({ ok: true, fromCache: true, payload: cached });
    }
    var u = c.url + '/api/kpi-summary?scope=' + encodeURIComponent(scope);
    if (opts.since) u += '&since=' + encodeURIComponent(opts.since);
    if (opts.partition) u += '&partition=' + encodeURIComponent(opts.partition);
    return fetchWithRetry(u, c.token).then(function (res) {
      if (res.ok) writeCache(scope, res.payload);
      return res;
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
    clearCache: clearCache
  };
})(typeof window !== 'undefined' ? window : globalThis);
