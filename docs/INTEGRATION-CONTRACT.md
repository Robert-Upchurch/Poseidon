# Poseidon Integration Contract — v1.0 (locked 2026-05-11)

**Status:** Locked before Agents A/B/C/D spawn. Any change requires Implementor sign-off.
**Owner:** Implementor (Claude Code).
**Consumers:** Agents A (Master), B (Finance), C (Marketing), D (Portals).

This document defines the **single contract** every Poseidon divisional dashboard must implement so the Master can aggregate. Violations fail the joint integration check; nothing merges to `main` until every contract test passes.

---

## 1. Endpoint

```
GET https://poseidon-proxy.<sub>.workers.dev/api/kpi-summary?scope=<scope>
```

| Path param | Required | Notes |
|---|---|---|
| `scope` (query) | yes | One of: `master`, `cruise`, `j1`, `finance`, `marketing`, `recruiting`, `it`, `contracts`, `operations`, `hr`. |
| `since` (query) | no | ISO 8601 datetime. If supplied, return deltas since that time. Default: full snapshot. |
| `partition` (query) | no | When scope=`finance`: `consolidated` (default), `entity:<branch_id>`. |

The Master Dashboard calls `scope=master` first (which fans out and aggregates) and uses the per-scope endpoints only when drilling into a single tile.

---

## 2. Auth

Every request — internal dashboards and Master alike — sends:

```
X-Dashboard-Token: <token rotated quarterly, stored client-side after first load>
```

If header missing or invalid: `401 { "error": "auth", "hint": "set X-Dashboard-Token header" }`.

Public portals do **not** call this endpoint — they have their own `/portal/*` routes.

---

## 3. Response shape (canonical)

```jsonc
{
  "scope": "j1",
  "captured_at": "2026-05-11T14:32:00Z",
  "fresh_until":  "2026-05-11T14:47:00Z",   // 15-min cache by default
  "source_state": {
    "primary":  "live",                      // "live" | "snapshot" | "stale"
    "fallback_from": null                    // null or "snapshot|stale" if degraded
  },
  "kpis": [
    {
      "id":        "j1_active_candidates",
      "label":     "Active J-1 candidates",
      "value":     142,
      "unit":      "count",                  // "count" | "USD" | "pct" | "days" | "ratio"
      "trend":     { "direction": "up", "delta": 8, "since": "7d" },
      "as_of":     "2026-05-11T14:30:00Z",
      "drilldown": "j1-system-dashboard.html#candidates"
    }
    /* … one entry per KPI tile … */
  ],
  "alerts": [
    {
      "id":      "j1_housing_capacity_low",
      "severity":"warning",                  // "info" | "warning" | "critical"
      "message": "Bangkok housing < 5 beds remaining",
      "link":    "j1-housing-finder-index.html?city=Bangkok"
    }
  ],
  "links": {
    "deep":  "j1-system-dashboard.html",
    "refresh_now": "/api/kpi-summary?scope=j1&_t=now"
  },
  "meta": {
    "version": "1.0",
    "owner_agent": "j1-system-dashboard",
    "partition_safe": true                   // true = no PII, safe for Master
  }
}
```

### 3.1 Field rules

- `captured_at` and `fresh_until` are required.
- `kpis[]` must contain **only** non-PII aggregate values when `partition_safe: true`. Concrete examples that pass: counts, totals, percentages, days-aging. Concrete examples that fail: candidate names, addresses, emails, account numbers, contract amounts tied to a single identifiable customer.
- `value` is a number. Strings are forbidden — format on the client.
- `unit` must be from the closed enum: `count, USD, pct, days, ratio, hours, MB`.
- `trend.since` is one of `1d, 7d, 30d, MTD, QTD, YTD`.
- `as_of` may differ from `captured_at` if the underlying source updates less often (e.g., a daily Zoho close).
- `drilldown` must be a same-origin URL the Master can iframe or link into.

### 3.2 Required KPIs per scope (minimum set — Master expects these)

| Scope | Required KPI IDs |
|---|---|
| `cruise` | `cruise_active_candidates`, `cruise_placements_mtd`, `cruise_pipeline_value_usd`, `cruise_overdue_tasks` |
| `j1` | `j1_active_candidates`, `j1_placements_mtd`, `j1_housing_beds_filled_pct`, `j1_sponsor_balance_usd`, `j1_overdue_tasks` |
| `finance` | `cash_total_usd`, `ar_total_usd`, `ar_aging_90_plus_usd`, `ap_total_usd`, `mtd_revenue_usd`, `ytd_revenue_usd`, `cash_runway_days` |
| `marketing` | `active_campaigns`, `mtd_ad_spend_usd`, `mtd_leads`, `blended_cac_usd`, `top_channel` (string in label, value=`null`, unit=`count` ignored) |
| `recruiting` | `recruiting_pipeline_value_usd`, `placements_mtd_combined`, `time_to_fill_days` |
| `it` | `health_pct`, `services_up`, `last_deploy_minutes_ago` |
| `contracts` | `contracts_active`, `contracts_pending`, `next_renewal_days` |
| `operations` | `tasks_open`, `tasks_overdue`, `vendors_active` |
| `hr` | `headcount`, `open_reqs`, `avg_tenure_days` |

If a divisional dashboard doesn't yet have the data for a required KPI, it must **return the KPI with `value: null` and `as_of: null`** — never omit the key. The Master renders `null` as `—` and tags the tile "not yet wired."

---

## 4. Caching

- Worker KV: `kpi-cache` namespace.
- Default TTL: 15 minutes.
- Override per-scope via response field `fresh_until`.
- Worker honors `?since=` for deltas; if no delta data is available, returns the full snapshot with `meta.delta_supported: false`.

---

## 5. Error envelope

Any non-2xx response uses:

```json
{
  "error": "string-code",
  "message": "human-readable",
  "scope": "j1",
  "captured_at": "2026-05-11T14:32:00Z",
  "retryable": true
}
```

Standard codes: `auth`, `rate-limit`, `upstream-fail`, `not-implemented`, `partition-violation`.

The Master Dashboard treats `retryable: true` errors as "render last good with stale badge"; `retryable: false` shows a red error tile and a "Re-run" button.

---

## 6. Worker route map (`poseidon-proxy`)

| Route | Owner | Implements |
|---|---|---|
| `/api/kpi-summary?scope=master` | Agent A | Fan-out aggregator; calls every other scope, merges, returns combined `kpis[]` |
| `/api/kpi-summary?scope=cruise` | (existing v6 ships a stub; Agent A wires it) | Cruise KPIs |
| `/api/kpi-summary?scope=j1` | Agent A (in J1 dashboard) | J-1 KPIs |
| `/api/kpi-summary?scope=finance` | Agent B | Zoho Books + Plaid (+ QBO stub) |
| `/api/kpi-summary?scope=marketing` | Agent C | Manual + Zoho CRM leads |
| `/api/kpi-summary?scope=recruiting` | Agent A | Aggregates Cruise + J-1 placement totals |
| `/api/kpi-summary?scope=it` | Agent A | Health checks, last deploy |
| `/api/kpi-summary?scope=contracts` | Agent A | Static contract index for v1 |
| `/api/kpi-summary?scope=operations` | Agent A | Tracker + tasks |
| `/api/kpi-summary?scope=hr` | Agent A | Manual headcount for v1 |

---

## 7. Joint integration check (gate before merge)

Before any feature branch can squash-merge to `main`:

1. Each agent's branch deploys preview (GitHub Pages preview or Worker preview env).
2. Implementor runs `tests/integration/kpi-contract.test.mjs` against each scope. Test verifies:
   - Required KPIs present.
   - `partition_safe: true` payloads contain no fields matching the PII regex set (`/email|phone|ssn|dob|account_number|address|first_name|last_name/i` in key names, plus a heuristic on values).
   - All `unit` values are within the enum.
   - All `drilldown` URLs return 2xx.
   - Response is < 64 KB.
3. Master Dashboard preview must render every scope's tiles without "null" surprises for required KPIs (`null` values are OK and must be rendered as `—` with the "not yet wired" tag).
4. Worker preview must respond < 800 ms p95 to `/api/kpi-summary?scope=master`.

If any check fails, the merge is blocked. The agent fixes its branch and re-requests review.

---

## 8. Branching + handoff

| Agent | Branch | Files agent may edit |
|---|---|---|
| Implementor | `main` only | `docs/*`, integration tests, this contract |
| Agent A — Master | `feat/master` | `poseidon-master-dashboard.html`, `js/master/*`, Worker `/api/kpi-summary` aggregator route, `docs/AGENT-LOG.md` (single-line entries) |
| Agent B — Finance | `feat/finance` | `cti-financial-dashboard.html`, `js/finance/*`, Worker `/qbo/*` + `/plaid/*` routes, `docs/CLOUDFLARE-WORKER-CHANGELOG.md` (single-line entries), `docs/AGENT-LOG.md` |
| Agent C — Marketing | `feat/marketing` | `cti-marketing-dashboard.html`, `js/marketing/*`, Worker `/marketing/*` routes, `docs/AGENT-LOG.md` |
| Agent D — Portals | `feat/portals` | New repos `cti-cruise-portal/`, `ghr-portal/`; Worker `/portal/*` routes, `docs/AGENT-LOG.md` |

**No agent edits files outside its scope** without writing a hand-off note in this document under §10 (Hand-offs).

---

## 9. Cross-agent shared utilities

To avoid duplication, the following live under `js/shared/` and are owned jointly (changes require Implementor review):

| File | Purpose |
|---|---|
| `js/shared/theme-toggle.js` | Light/dark switch + persistence |
| `js/shared/jarvis-context.js` | `data-jarvis-context` registration helper |
| `js/shared/kpi-client.js` | Fetches `/api/kpi-summary` with auth, caching, error envelope |
| `js/shared/chart-defaults.js` | Chart.js theme defaults |
| `js/shared/format.js` | `fmtUSD`, `fmtInt`, `fmtPct`, `fmtDays` |

Agent A creates the initial versions; Agents B/C/D import.

---

## 10. Hand-offs (append-only)

| Date | From → To | What | Why |
|---|---|---|---|
| — | — | — | — |

---

## 11. Versioning

`meta.version` starts at `1.0`. Breaking changes (renaming a required KPI, changing the auth header, removing a scope) bump major and require all consumers to update. Additive changes (new optional KPI, new alert severity) bump minor.

---

*Locked. Spawn the agents.*
