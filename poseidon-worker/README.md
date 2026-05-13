# poseidon-worker

Source of the Cloudflare Worker `poseidon-proxy` (live at `https://poseidon-proxy.robertupchurch6121.workers.dev`). Pulled into the repo on 2026-05-13 as Phase 1a of the Microsoft 365 SSO rollout.

## Layout

```
src/
  index.js          deployed bundle (esbuild output — multiple original
                    modules concatenated, module boundaries marked with
                    `// src/<name>.js` comments)
  auth/             new modules added Phase 1b — JWT validator, allowlist,
                    middleware
wrangler.toml       deploy config — mirrors the live Worker settings
package.json        wrangler dev dependency
```

`src/index.js` is the deployed bundle — not original source files. When wrangler deploys, it re-bundles `main` plus any `import`s. Phase 1b adds `import { withAuth } from './auth/middleware.js'` to the top of `index.js` to pull in the new auth modules.

## Deploy

```powershell
cd "C:\Users\ceo\OneDrive\POSEIDON\Poseidon\poseidon-worker"
npm install          # one-time, installs wrangler locally
npx wrangler deploy
```

Requires `wrangler login` (browser OAuth) one time per machine. Already done on Robert's machine.

## Secrets (set via wrangler, never committed)

| Secret | Purpose |
|---|---|
| `DASHBOARD_TOKEN` | Legacy `X-Dashboard-Token` shared secret (Layer B fallback through Phase 4) |
| `JWT_SIGNING_KEY` | Applicant tracking-token signing for cruise/ghr portals |
| `ZOHO_CRM_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | Zoho CRM OAuth |
| `POSEIDON_AUTH_BYPASS_TOKEN` | Phase 1c — Layer A kill-switch, random 32-byte hex |
| `POSEIDON_EMAIL_ALLOWLIST` | Phase 1c — comma-separated allowed emails |
| `POSEIDON_LEGACY_TOKEN_ENABLED` | Phase 1c — `true` until Phase 5 |

To list current secrets (names only, not values):
```powershell
npx wrangler secret list
```

To rotate a secret:
```powershell
npx wrangler secret put DASHBOARD_TOKEN
```

## Routes

| Path | Auth | Notes |
|---|---|---|
| `GET /health`, `GET /api/health` | public | health check |
| `POST /api/portal-intake/cruise` | public | applicant submission (cruise portal) |
| `POST /api/portal-intake/ghr` | public | applicant submission (J-1/GHR portal) |
| `GET /api/portal-status/:token` | public token-bearer | applicant tracking by signed token |
| `GET /api/kpi-summary?scope=...` | gated | dashboard KPI aggregation |
| `* /api/*` other | gated | catch-all |

Gated routes today: `checkAuth(req, env)` validates `X-Dashboard-Token` against the `DASHBOARD_TOKEN` secret. Phase 1c replaces this with `checkSSO(req, env)` — see `src/auth/middleware.js`.
