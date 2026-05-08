# LOCKED BASELINE — v6.3.0 (2026-05-08)

**This commit is the stable baseline. Do not modify any dashboard file
without an explicit feature request or bug report from Robert.**

Latest tag: `v6.3.0-cross-origin-jarvis` — adds cross-origin Jarvis reading
Previous tag: `v6.2.0-baseline` (commit `3b73769`) — initial lockdown

## v6.3.0 changes from v6.2.0

- Snapshot publisher injected into all 3 dashboards (`?cti-snapshot=1`)
- `read_remote_dashboard` Jarvis tool added to PoseidonJarvis + UpchurchJarvis
- Cross-origin verified working both directions (16 + 31 pages readable)

## Verified working

| Dashboard | Health checks | Jarvis tools | Layout |
|---|---|---|---|
| Poseidon Dashboard V6 | 24/24 ✅ | 53 ✅ | clean ✅ |
| J1 System Dashboard | 24/24 ✅ | 53 ✅ | clean ✅ |
| Upchurch Financial Dashboard | xAI WebSocket OPEN ✅ | full ✅ | clean ✅ |

Cross-dashboard sync via BroadcastChannel `cti-poseidon-sync` + localStorage
snapshots is live. SSO via localStorage gate + MSAL auto-trigger is live.

## Files protected by this baseline

- `poseidon-dashboard-v6.html`
- `j1-system-dashboard.html`
- `j1-housing-finder-index.html`
- `index.html`
- `js/poseidon-modules/*.js` (especially `poseidon-jarvis-grok.js`)
- `service-worker.js`

## Allowed changes (no approval needed)

- Daily content updates to `config/jarvis-memory.md` and `config/cti-snapshot-*.json`
- Cron-driven KPI refreshes via `data-kpi` attributes (NOT text-anchor regex)

## NEVER allowed without explicit approval

- Refactoring layouts
- Renaming functions or changing signatures
- Adding new dependencies / bumping CDN versions
- Reorganizing folder structure
- Touching the password gate or MSAL config

## Pre-flight before ANY change

1. `git pull`
2. Open both live URLs, run in console:
   ```js
   const r = window.poseidonHealth({ verbose: false });
   console.log(`${r.results.filter(x=>x.ok).length}/${r.results.length} pass`);
   ```
   Both must show `24/24 pass`.

## Pre-flight AFTER any change

1. `node --check js/poseidon-modules/poseidon-jarvis-grok.js`
2. Verify balanced `<script>` / `</script>` counts in HTML files
3. Verify file ends with `</body></html>`
4. Reload live URL, run System Check, must still be 24/24 green
5. `typeof window.PoseidonJarvis === 'object'` must be true

## Recovery from a bad change

```bash
git checkout v6.2.0-baseline -- poseidon-dashboard-v6.html \
  j1-system-dashboard.html \
  js/poseidon-modules/poseidon-jarvis-grok.js
```

## Patches that broke this baseline (DO NOT REPEAT)

1. Anchoring `<script>` injection on `</body></html>` with Python `find()` —
   multiple `</body></html>` strings exist inside JS template literals in the
   print-export popups. Always use `rfind()`.
2. Re-running cross-dashboard patches that mutate the state-object closing —
   leaves orphan `pendingToolCalls: new Map() };` outside any object,
   triggering SyntaxError.
3. Edit tool on 7000+ line dashboard files — silently truncates near 1000-byte
   boundaries. Always use Python file IO for these.
