/* Poseidon shared — Chart.js defaults tuned to v6.5.0 tokens.
   Call ChartDefaults.apply() once after Chart.js loads; re-applies on theme change. */
(function (root) {
  'use strict';

  function tokens() {
    var dark = document.documentElement.classList.contains('dark');
    return dark
      ? {
          text: '#fafafa',
          grid: 'rgba(255,255,255,0.08)',
          tick: '#93c5fd',
          tooltipBg: '#0f1e2e',
          tooltipBorder: '#1e293b',
          accent: '#14b8a6'
        }
      : {
          text: '#0f172a',
          grid: 'rgba(0,0,0,0.08)',
          tick: '#1e40af',
          tooltipBg: '#ffffff',
          tooltipBorder: '#e2e8f0',
          accent: '#0d9488'
        };
  }

  function apply() {
    if (typeof Chart === 'undefined') return;
    var t = tokens();
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.color = t.text;
    Chart.defaults.borderColor = t.grid;
    Chart.defaults.plugins.tooltip.backgroundColor = t.tooltipBg;
    Chart.defaults.plugins.tooltip.borderColor = t.tooltipBorder;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = t.text;
    Chart.defaults.plugins.tooltip.bodyColor = t.text;
    Chart.defaults.plugins.legend.labels.color = t.text;
    document.dispatchEvent(new CustomEvent('poseidon:chart-defaults-applied'));
  }

  document.addEventListener('poseidon:theme', apply);
  root.ChartDefaults = { apply: apply, tokens: tokens };
})(typeof window !== 'undefined' ? window : globalThis);
