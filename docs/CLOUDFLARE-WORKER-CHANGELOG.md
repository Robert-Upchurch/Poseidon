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
