/* Master router — hash-based section switching + Jarvis context registration. */
(function (root) {
  'use strict';

  function showSection(id) {
    var sections = document.querySelectorAll('main [data-section]');
    sections.forEach(function (s) {
      var match = s.getAttribute('data-section') === id;
      s.classList.toggle('hidden', !match);
    });
    var links = document.querySelectorAll('nav.sidebar [data-nav]');
    links.forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('data-nav') === id);
      l.setAttribute('aria-current', l.getAttribute('data-nav') === id ? 'page' : 'false');
    });
    if (root.JarvisContext) root.JarvisContext.set({ page: 'master', tab: id });
    document.dispatchEvent(new CustomEvent('poseidon:nav', { detail: { tab: id } }));
  }

  function fromHash() {
    var h = (location.hash || '#overview').replace(/^#/, '');
    return h.split('/')[0] || 'overview';
  }

  function init() {
    showSection(fromHash());
    window.addEventListener('hashchange', function () { showSection(fromHash()); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-nav]');
      if (!t) return;
      var id = t.getAttribute('data-nav');
      if (!id) return;
      if (t.tagName === 'A' && t.getAttribute('href') && t.getAttribute('href').charAt(0) !== '#') return; // external link
      e.preventDefault();
      location.hash = '#' + id;
      var drawer = document.querySelector('nav.sidebar');
      if (drawer) drawer.classList.remove('open');
      var ov = document.getElementById('sidebar-overlay');
      if (ov) ov.classList.remove('open');
      document.body.classList.remove('drawer-open');
    });
  }

  root.MasterRouter = { init: init, showSection: showSection };
})(typeof window !== 'undefined' ? window : globalThis);
