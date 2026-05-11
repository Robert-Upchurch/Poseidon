# Cloudflare Worker — `poseidon-proxy` change log

Append-only log of every route + secret added to the Cloudflare Worker.
Robert deploys the Worker manually after each entry's secrets are loaded into
the Worker's encrypted-secret store.

The Worker template lives at `docs/cloudflare-worker-template.js` in the
repo. Setup guide: `docs/cloudflare-worker-setup.md`.

CORS allowlist (already configured): `https://robert-upchurch.github.io`.
For portal previews on GitHub Pages project sites, add:
`https://robert-upchurch.github.io/cti-cruise-portal` and
`https://robert-upchurch.github.io/ghr-portal` once those repos are live.

---

## 2026-05-11 — Finance routes plan (Agent B / Implementor)

### `/qbo/companyinfo`  (GET)
- **Purpose:** identify the connected QBO entity (legal name, EIN last 4, realm).
- **Status:** **not deployed** — no QBO connector configured anywhere (see `docs/ASSUMPTIONS.md` §Q14).
- **Request:** `GET /qbo/companyinfo` with `X-Dashboard-Token` header.
- **Response:**
  ```json
  { "ok": true, "company": { "legal_name": "…", "ein_last4": "…", "realm_id": "…", "env": "production|sandbox" } }
  ```
- **Secrets needed:** `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REFRESH_TOKEN`, `QBO_REALM_ID`, `QBO_ENV` (`sandbox`|`production`).
- **Test:** `curl -H "X-Dashboard-Token: $T" $WORKER/qbo/companyinfo`

### `/qbo/accounts/balance`  (GET)
- **Purpose:** bank/credit balances from QBO.
- **Response:**
  ```json
  { "ok": true, "accounts": [{ "id": "…", "name": "…", "type": "Bank|CreditCard|Asset", "balance": 12345.67, "currency": "USD" }] }
  ```
- **Test:** `curl -H "X-Dashboard-Token: $T" $WORKER/qbo/accounts/balance`

### `/qbo/transactions`  (GET)
- **Params:** `?since=<iso8601>` `&account_id=<id>` (optional) `&limit=<n>` (default 100).
- **Response:** `{ "ok": true, "transactions": [...] }` — each tx has `id`, `date`, `description`, `amount`, `account_id`, `category`.
- **Test:** `curl -H "X-Dashboard-Token: $T" "$WORKER/qbo/transactions?since=2026-05-01"`

### `/qbo/invoices`  (GET / POST)
- **GET params:** `?status=open|paid|overdue` `&customer_id=` `&limit=`.
- **POST body:** `{ customer_id, line_items: [...], due_date, currency }` — creates an invoice. **Auth additionally requires** a `X-Action-Token` (per-write rotating token, separate from read token).
- **Test:** `curl -H "X-Dashboard-Token: $T" "$WORKER/qbo/invoices?status=open"`

---

### `/plaid/link-token`  (POST)
- **Purpose:** create a Link token so the dashboard can launch Plaid Link.
- **Request body:** `{ user_id?: "robert", products: ["transactions","balance"], country_codes: ["US"] }`.
- **Response:** `{ ok: true, link_token: "link-...", expiration: "<iso>" }`.
- **Secrets needed:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox`|`development`|`production`).
- **Cost note:** the env is read from `PLAID_ENV`; the dashboard's Settings → Plaid env radio writes to `localStorage` and the Worker honors the per-request header `X-Plaid-Env-Override` if present (sandbox/dev only — production override blocked server-side).
- **Test:** `curl -X POST -H "X-Dashboard-Token: $T" $WORKER/plaid/link-token`

### `/plaid/exchange`  (POST)
- **Purpose:** exchange a public token (from Link) for a long-lived access token.
- **Request body:** `{ public_token: "public-..." }`.
- **Response:** `{ ok: true, item_id: "…" }` — the access token is **encrypted and stored server-side** (Worker KV `plaid-items`); never returned to the browser.

### `/plaid/balance`  (GET)
- **Response:** `{ ok: true, accounts: [{ item_id, institution, name, mask, type, subtype, balance_current, balance_available, iso_currency }] }`.
- **Cron:** balances cached for 15 min in Worker KV.

### `/plaid/transactions/sync`  (GET)
- **Params:** `?cursor=<token>` (optional — for incremental sync).
- **Response:** `{ ok: true, transactions: [...], next_cursor: "…" }`.
- **Cron:** Worker triggers `/transactions/sync` against every stored item every 60 minutes.

---

### Required new Worker secrets (collated)

| Secret | Source |
|---|---|
| `QBO_CLIENT_ID` | Intuit Developer dashboard |
| `QBO_CLIENT_SECRET` | Intuit Developer dashboard |
| `QBO_REFRESH_TOKEN` | OAuth bootstrap (one-time browser flow, captured into the Worker) |
| `QBO_REALM_ID` | Intuit Developer dashboard (per company) |
| `QBO_ENV` | `production` once Robert connects a CTI entity; `sandbox` for testing |
| `PLAID_CLIENT_ID` | dashboard.plaid.com → Team Settings → Keys |
| `PLAID_SECRET` | dashboard.plaid.com (per environment — separate secrets for sandbox vs development vs production) |
| `PLAID_ENV` | `sandbox` (default), then `development`, then `production` after Robert authorizes |
| `JWT_SIGNING_KEY` | 32 random bytes — used by portal status-check tokens (see Agent D entry below) |
| `ACTION_TOKEN_SECRET` | 32 random bytes — used to derive the per-write `X-Action-Token` |

### Required KV namespaces

| KV | Purpose |
|---|---|
| `kpi-cache` | 15-min TTL per scope for `/api/kpi-summary` aggregator |
| `plaid-items` | Encrypted Plaid access tokens keyed by `item_id` |
| `qbo-tokens` | Encrypted QBO refresh/access tokens |
| `oauth-state` | Short-lived (10 min) OAuth `state` tokens for bootstrap flows |

### Required Worker cron triggers

| Cron | What it runs |
|---|---|
| `*/15 * * * *` | `/plaid/balance` refresh for every stored item; cache to `kpi-cache:finance` |
| `0 * * * *`    | `/plaid/transactions/sync` per stored item |
| `0 11 * * *`   | (06:00 ET) Zoho Books P&L pull → snapshot file commit via GitHub API |
| `0 12 * * 1/2` | (07:00 ET every other Monday) biweekly close: P&L + balance sheet + AR/AP aging + tax accrual → render PDF → email to ceo@cti-usa.com → append entry to `config/financial-closes/index.json` |

### Cost estimate (Plaid Production)

Per `docs/ASSUMPTIONS.md` §Q17: ~28 accounts (7 entities × ~2 banks × ~2 accts).
- Balance product only: ~$0.30/acct/mo → **~$8/mo**
- Transactions: ~$0.30 base + $0.10/acct/mo → **~$3 + $2.80 ≈ $6/mo**
- Net at full Production coverage: **~$14/mo–$17/mo**.

Real number after Sandbox Item count is confirmed.

---

Six new routes for the two public candidate-intake portals. These are documented now so the Worker code is written before the portals reach production. None are live yet.

### Route: `POST /portal/cruise/apply`

- **Owner:** Agent D
- **Purpose:** Accept Cruise candidate application from `cti-cruise-portal/apply.html`
- **CORS origin:** `https://robert-upchurch.github.io` (and the future custom domain)
- **Auth:** none (public endpoint). Requires reCAPTCHA Enterprise token in body (`_recaptcha`).
- **Request body (JSON):** Object matching `cti-cruise-portal/assets/schemas/cruise-application.json`. Plus `_recaptcha`, `_captured_at`, `_portal: "cruise"`, `_target_module: "Candidates"`, and `_files` (array of file metadata).
- **Side effects:**
  1. Create a record in Zoho CRM module `Candidates` (CustomModule13) with `Candidate_Type = "Cruise"`, `Lead_Source = "Cruise Web Portal"`.
  2. Generate a 24-hour HS256 JWT signed with `JWT_SIGNING_KEY`. Claims: `{ candidate_id, portal: "cruise", iat, exp }`.
  3. Email the candidate a tracking link via Resend (`RESEND_API_KEY`): `https://<portal-domain>/track.html?token=<jwt>`.
- **Response (200):** `{ token: "<jwt>", status_url: "https://<portal-domain>/track.html?token=<jwt>" }`
- **Errors:** `400` schema validation; `429` rate-limit; `500 { error: "zoho_write_failed" }` on upstream.

### Route: `GET /portal/cruise/status/<token>`

- **Owner:** Agent D
- **Purpose:** Status check for Cruise candidate via signed JWT
- **Auth:** JWT in path verified against `JWT_SIGNING_KEY`. Reject if expired (>24h) or wrong portal claim.
- **Behavior:**
  1. Verify JWT.
  2. Look up record in Zoho CRM `Candidates` module by `candidate_id`.
  3. Return only safe fields - no PII echoed back to the candidate beyond what they already know.
- **Response (200):** `{ stage: string, last_updated: ISO8601 }`
- **Errors:** `401` invalid/expired token; `404` candidate not found.

### Route: `POST /portal/cruise/contact`

- **Owner:** Agent D
- **Purpose:** Contact-form submissions from Cruise portal
- **Auth:** reCAPTCHA token required.
- **Request body:** `{ first_name, last_name, email, phone?, topic, message, _recaptcha, _captured_at }`
- **Side effects:** Email `ceo@cti-usa.com` via Resend with subject `[Cruise Portal] <topic> from <name>`. Optionally also create a Zoho CRM `Leads` record with `Lead_Source = "Cruise Portal Contact"`.
- **Response (200):** `{ ok: true }`

### Route: `POST /portal/ghr/apply`

- **Owner:** Agent D
- **Purpose:** Accept GHR Cultural Exchange + land hospitality application from `ghr-portal/apply.html`
- **CORS origin:** same allowlist as cruise.
- **Auth:** reCAPTCHA token required.
- **Request body (JSON):** Object matching `ghr-portal/assets/schemas/ghr-application.json`. Plus `_recaptcha`, `_captured_at`, `_portal: "ghr"`, `_target_module: "J1_Candidates"`, and `_files`.
- **Side effects:**
  1. Create a record in Zoho CRM module `J1_Candidates` (CustomModule12) with `Stage = "Pre-application"`, `Lead_Source = "GHR Web Portal"`. If `track == "Land Hospitality"`, also set `Candidate_Type = "Hospitality"`.
  2. Generate JWT (`portal: "ghr"`).
  3. Email candidate tracking link via Resend.
- **Response (200):** `{ token, status_url }`
- **Errors:** same envelope as cruise.

### Route: `GET /portal/ghr/status/<token>`

- **Owner:** Agent D
- **Purpose:** Status check for GHR candidate via signed JWT
- **Behavior:**
  1. Verify JWT (must claim `portal: "ghr"`).
  2. Look up record in `J1_Candidates` by `candidate_id`.
  3. If candidate has been placed and housing summary is available, attach a **partition-safe** housing preview - aggregate only (region, beds_filled_pct, summary string). No exact address until placement deposit is confirmed.
- **Response (200):** `{ stage, last_updated, housing_preview_safe: { region?, beds_filled_pct?, summary? } | null }`
- **Errors:** `401`, `404`.

### Route: `POST /portal/ghr/contact`

- **Owner:** Agent D
- **Purpose:** Contact-form submissions from GHR portal
- Same shape as `/portal/cruise/contact`, different subject prefix `[GHR Portal]`.

---

### JWT signing approach

- Algorithm: **HS256**
- Secret: Worker secret `JWT_SIGNING_KEY` (32-byte random, base64). Single key shared by both portals; the `portal` claim disambiguates.
- TTL: **24 hours** from issuance.
- Claims: `{ candidate_id: string, portal: "cruise" | "ghr", iat: number, exp: number }`.
- Library: Web Crypto API in the Worker (`crypto.subtle.sign` / `verify`) - no npm dependency.
- Rotation: rotate the secret quarterly. Outstanding tokens become invalid - acceptable for a 24h-TTL link.

### Secrets to add (not yet deployed)

| Secret | Source | For |
|---|---|---|
| `JWT_SIGNING_KEY` | Generated (32 bytes random, base64) | Sign and verify portal status JWTs |
| `RECAPTCHA_SECRET` | Google reCAPTCHA Enterprise | Portal intake spam protection |
| `RESEND_API_KEY` | resend.com | Outbound email for tracking links and contact forms |

### CORS

Add these origins to `ALLOWED_ORIGIN` (comma-separated, if not already):
- `https://robert-upchurch.github.io` (project pages for the new portal repos)
- Future custom domain(s) per `ASSUMPTIONS.md` Q27

### Status

- **Routes documented:** yes (this file)
- **Worker code edited:** no - Agent D builds the portals first, Agent B (Finance) or a follow-up commit wires the Worker
- **Live URL:** no Worker deployed yet per `ASSUMPTIONS.md` Q4. Portal JS gracefully shows "Saved offline" on 404 / network error.
