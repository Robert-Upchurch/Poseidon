/* Poseidon shared — theme toggle + persistence.
   Pair with pre-paint inline script in <head> that reads localStorage early.
   Public API: ThemeToggle.attach(buttonEl), ThemeToggle.current(). */
(function (root) {
  'use strict';
  var KEY = 'poseidon-theme';

  function isDark() { return document.documentElement.classList.contains('dark'); }

  function apply(theme) {
    var el = document.documentElement;
    if (theme === 'light') el.classList.remove('dark');
    else el.classList.add('dark');
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    document.dispatchEvent(new CustomEvent('poseidon:theme', { detail: { theme: theme } }));
  }

  function toggle() { apply(isDark() ? 'light' : 'dark'); }

  function current() { return isDark() ? 'dark' : 'light'; }

  function attach(btn) {
    if (!btn) return;
    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  root.ThemeToggle = { attach: attach, current: current, apply: apply, toggle: toggle };
})(typeof window !== 'undefined' ? window : globalThis);
