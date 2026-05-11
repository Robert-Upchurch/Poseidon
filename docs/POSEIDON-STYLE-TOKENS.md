# Poseidon Style Tokens — v6.5.0 (canonical)

**Source:** `poseidon-dashboard-v6.html` head + first ~600 lines of inline `<style>` (extracted 2026-05-11 from `main@faecd4d`).
**Authority:** every new artifact (Master, Financial, Marketing, Cruise Portal, GHR Portal) **must** import these tokens unmodified. Divergence requires a one-line entry at the bottom of this file.

---

## Stack (do not bump versions without coordination)

| Dependency | Pin | Notes |
|---|---|---|
| Tailwind | `cdn.tailwindcss.com` (no pin) | Used as a runtime CDN with `tailwind.config` inline |
| Chart.js | `4.4.0` | `cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` |
| MSAL | `3.6.0` | `cdn.jsdelivr.net/npm/@azure/msal-browser@3.6.0/lib/msal-browser.min.js` |
| Lucide | `latest` | `unpkg.com/lucide@latest` |
| Fonts | Inter 400/500/600/700; JetBrains Mono 500/700 | Google Fonts |

**No build step.** Single-file HTML with inline `<style>` + `<script>` blocks. Modular JS lives under `js/poseidon-modules/<name>.js`.

---

## CSS variables (root)

```css
:root {
  --cti-teal:        #14b8a6;   /* primary accent */
  --cti-teal-hover:  #0d9488;   /* button hover */
  --cti-teal-soft:   #2dd4bf;   /* highlight / active nav text */
  --cti-navy:        #0a1628;   /* dark bg */
  --cti-navy-panel:  #0f1e2e;   /* panel surface */
  --cti-navy-card:   #122336;   /* card surface */
}
```

---

## Color palette

### Dark mode (default)
| Token | Hex | Use |
|---|---|---|
| Background | `#0a1628` | `body`, sidebar |
| Panel | `#0f1e2e` | section panels (`bg-zinc-900/60` → remapped) |
| Card | `#122336` | KPI cards (`bg-zinc-900` → remapped) |
| Border | `#1e293b` | dividers, panel edges |
| Border (subtle) | `#334155` | inner card borders |
| Text — primary | `#fafafa` | body |
| Text — h2 | `#f8fafc` with `text-shadow: 0 1px 3px rgba(0,0,0,0.4)` | section heads |
| Text — h3 | `#e0e7ff` | subsection heads |
| Text — muted | `#93c5fd` | small captions |
| Accent | `#14b8a6` | teal-500 primary |
| Accent hover | `#0d9488` | teal-600 |
| Accent soft | `#2dd4bf` | teal-400 (active nav text) |
| Active nav pill | `linear-gradient(135deg, rgba(20,184,166,0.22), rgba(45,212,191,0.12))` border `rgba(20,184,166,0.35)` | sidebar selected |

### Light mode
| Token | Hex | Use |
|---|---|---|
| Background | `#f8fafc` | body |
| Sidebar | `linear-gradient(180deg,#ffffff,#f1f5f9)` border `#e2e8f0` | left nav |
| Panel | `#ffffff` | section panels |
| Card | `#f1f5f9` | KPI cards |
| Border | `#e2e8f0` | dividers |
| Border (subtle) | `#cbd5e1` | inputs |
| Text — primary | `#0f172a` | body |
| Text — h3 | `#1e3a8a` | subsection heads |
| Text — muted | `#1e40af` | small captions |
| Accent | `#14b8a6` | unchanged |
| Accent hover | `#0d9488` | unchanged |
| Active nav pill | bg `#bae6fd` (sky-200) / text `#0c4a6e` (sky-900) / border `#7dd3fc` (sky-300) | sidebar selected |

### KPI left-accent colors (themed)
| Tailwind class | Effective color | Recommended use |
|---|---|---|
| `border-l-indigo-500` | `#14b8a6` (teal remap) | default KPI |
| `border-l-blue-500` | `#3b82f6` | informational |
| `border-l-rose-500` | `#f43f5e` | risk / overdue |
| `border-l-emerald-500` | `#10b981` | revenue / positive |
| `border-l-sky-500` | `#0ea5e9` | secondary |
| `border-l-amber-500` | `#f59e0b` | warning |
| `border-l-fuchsia-500` | `#d946ef` | special / experimental |

---

## Typography

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

Tailwind config:
```js
fontFamily: {
  sans: ['Inter','sans-serif'],
  mono: ['JetBrains Mono','monospace']
}
```

System fallback stack (applied in `body`):
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text',
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

Use `font-mono` only for: numeric data, hashes, file paths, version strings.

---

## Theme toggle pattern (mandatory, per global CLAUDE.md)

1. `<html lang="en" class="dark">` — start in dark.
2. `tailwind.config.darkMode = 'class'`.
3. Pre-paint script in `<head>` (before first paint) to read `localStorage.poseidon-theme` and add/remove `.dark` on `<html>`. Prevents flash-of-incorrect-theme.
4. Header button: sun / moon icon, toggles `.dark`, writes `localStorage.poseidon-theme`.
5. Color-scheme meta:
   ```html
   <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)">
   <meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)">
   ```

---

## Layout primitives

- **Sidebar**: fixed left, full-height. Dark: `bg #0a1628` border `#1e293b`. Light: gradient. Mobile (`<1280px`): translates `-100%`, slides in with `transition: transform 0.28s cubic-bezier(.4,0,.2,1)`. Width 280px on mobile.
- **Mobile overlay**: `rgba(0,0,0,0.55)` backdrop with `backdrop-filter: blur(2px)`. `z-index: 45`.
- **Header**: assignment logo left, CTI logo right, theme toggle + user badge + system check on the right cluster.
- **Main content**: scrollable, page transitions via `@keyframes fadeIn` over 0.25s.
- **Touch targets** (`<1280px`): nav links 12px/14px padding, `min-height: 44px` (Apple HIG).
- **Safe-area**: `padding-top: max(20px, env(safe-area-inset-top))` on sidebar + `padding-bottom: calc(20px + env(safe-area-inset-bottom))` on main.

---

## Component recipes

### KPI card
```html
<div class="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-5 border-l-4 border-l-emerald-500">
  <p class="text-xs font-mono uppercase tracking-wider text-zinc-500">Cash position</p>
  <p class="text-3xl font-bold text-zinc-100 mt-2">$185,001.25</p>
  <p class="text-xs text-zinc-500 mt-1">Across 5 accounts · refreshed 5 min ago</p>
</div>
```

### Section panel
```html
<section class="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
  <h2 class="text-2xl font-semibold text-zinc-100">Financial Snapshot</h2>
  ...
</section>
```

### Primary button (teal)
```html
<button class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg
               text-sm font-medium transition-colors">
  Refresh
</button>
```
(Tailwind's indigo classes are remapped to teal by the CSS rules in v6.)

### Icon
```html
<i data-lucide="chart-line" class="w-5 h-5 text-teal-400"></i>
```
Initialize once with `lucide.createIcons()` after DOM is ready.

---

## Page transition keyframes
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page:not(.hidden) { animation: fadeIn 0.25s ease-out; }
.page.hidden       { display: none !important; }
```

---

## Scrollbars

```css
.dark ::-webkit-scrollbar               { width: 6px; }
.dark ::-webkit-scrollbar-track         { background: transparent; }
.dark ::-webkit-scrollbar-thumb         { background: rgba(255,255,255,0.1); border-radius: 3px; }
.dark ::-webkit-scrollbar-thumb:hover   { background: rgba(255,255,255,0.2); }
html:not(.dark) ::-webkit-scrollbar-thumb       { background: rgba(0,0,0,0.15); border-radius: 3px; }
html:not(.dark) ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
```

---

## Glow effect (used on hero/important cards)
```css
.glow { box-shadow: 0 0 40px rgba(20,184,166,0.15); }
```

---

## Banned patterns

- ❌ Hard-coded indigo / purple / brand-color hex values inline. Use the teal CSS variables.
- ❌ `bg-white` in dark mode (use `bg-zinc-900/60` for panels and let CSS remap).
- ❌ Inline `style="color: …"` for theme-aware colors. Use Tailwind classes that get remapped.
- ❌ Mixing `font-family: Roboto` etc. — Inter only, with the documented fallback stack.
- ❌ Skipping the pre-paint script — causes a one-frame flash.
- ❌ Hard-coding any third-party CDN version other than the ones listed above. Coordinate any bump with the BASELINE.

---

## Divergence log (append-only)

| Date | File | Token deviated | Reason |
|---|---|---|---|
| — | — | — | — |
