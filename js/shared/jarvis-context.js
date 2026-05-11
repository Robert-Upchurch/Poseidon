/* Poseidon shared — Jarvis context registration.
   Every page calls JarvisContext.set({page, tab, recordId?}) so Jarvis can read
   what the user is currently looking at via data-jarvis-context on <html>. */
(function (root) {
  'use strict';

  function set(ctx) {
    var html = document.documentElement;
    var payload = Object.assign({}, ctx || {});
    payload.ts = new Date().toISOString();
    html.setAttribute('data-jarvis-context', JSON.stringify(payload));
    try { window.JARVIS_CONTEXT = payload; } catch (e) {}
  }

  function get() {
    var raw = document.documentElement.getAttribute('data-jarvis-context');
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  root.JarvisContext = { set: set, get: get };
})(typeof window !== 'undefined' ? window : globalThis);
