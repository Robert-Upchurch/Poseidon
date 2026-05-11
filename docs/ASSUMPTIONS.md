# Assumptions Log — Poseidon Master Build

Per the Orchestrator's 2026-05-11 directive: for any question in `POSEIDON-MASTER-AUDIT.md` §9 that wasn't explicitly answered, use best judgment and document the call here. Material cost or compliance items are flagged **⚠ Surface to Robert**.

---

## Investigation results (filling the explicit answers)

### Q1 — Git clone (answered + executed)
- **Executed:** repo cloned to `C:\Users\ceo\OneDrive\POSEIDON\Poseidon\` using `git clone --separate-git-dir=C:\Users\ceo\GitData\Poseidon.git ...`. The visible `.git` is a 1-line pointer file; the actual git database lives at `C:\Users\ceo\GitData\Poseidon.git` **outside** OneDrive — sync corruption is now physically impossible.
- **Cross-device caveat:** the pointer file contains an absolute Windows path. If the OneDrive working tree syncs to another machine, the pointer will point at a nonexistent path on that device. On-the-go editing should use github.dev / GitHub mobile / Claude Code with a fresh `git clone` per device — **not** OneDrive sync as a git substitute. ⚠ Surface only if Robert expected OneDrive to make the repo "magically appear" on a second laptop.

### Q3 — Backend = Cloudflare Worker (locked in)
Vercel references in the prompt are deprecated. All proxy work targets the existing `docs/cloudflare-worker-template.js` pattern. QBO + Plaid routes will be appended to that worker.

### Q4 — Worker subdomain
**No worker is currently deployed.** Confirmed by:
- No `workers.dev` URL appears in any HTML or JS file in the repo.
- `j1-housing-dashboard.html` defines `RD_CONFIG.proxyBaseUrl = ''` (empty string) with a comment placeholder `'https://poseidon-api.cti-usa.com'`.
- The setup doc `docs/cloudflare-worker-setup.md` is a how-to, not a record of an existing deployment.

**Decision:** Agent B (Finance) will deploy the worker as part of Phase 3 under the name `poseidon-proxy` and capture the resulting URL into `docs/INTEGRATION-CONTRACT.md`. The dashboard's Settings panel will gain a "Worker URL" field so the subdomain is configurable per-environment (Robert's Cloudflare account vs. any future deploy target).

### Q5 — Style + baseline
Locked. `BASELINE.md` stays in force for existing v6 files. New files (`poseidon-master-dashboard.html`, `cti-financial-dashboard.html`, `cti-marketing-dashboard.html`, plus the two portal repos) follow the tokens captured in `docs/POSEIDON-STYLE-TOKENS.md`.

### Q6 — Auth model
Locked. MSAL + password gate for internal dashboards. Public portals: candidate intake pages are anonymous (no MSAL prompt); the candidate's own status-check page requires MSAL (single-tenant CTI Entra) OR a short-lived signed token emailed at intake (fallback for candidates without Microsoft accounts). Defaulting to **emailed signed token** because most candidates won't have a CTI Entra identity. ⚠ Confirm — the Hybrid Option B doc from 2026-04-25 already implied this; restating to be explicit.

### Q10 — J1 nav
Locked: link out and replace Master shell. Persistent "Back to Master" header pill on J1.

### Q13 — Zoho Books org reality
**Major finding from `list_organizations` MCP call:** there is **only one** Zoho Books organization on Robert's account:
- `877439787` — CTI Group Worldwide Services Inc.
- Plan: Zoho One ENTERPRISE_NEW. `is_multientity_org: false`. Single USD ledger, single Eastern timezone.

The prompt's claim of "5 orgs: cti_group, ghr_j1, cti_marine, baron, uno" is **not how Zoho is currently set up**. The other entities are tracked as **branches** inside the one Zoho Books org (consistent with the repo's CLAUDE.md statement: "Branches: Head Office, Marine Travel, Sea Based").

**Assumption (no Q13 follow-up needed):** the Financial Dashboard will pivot revenue/expense data by `branch_id`, not by org_id. The single Zoho Books org is the entire CTI bookkeeping ledger today.

⚠ **Surface to Robert:** if CTI ever wants true legal-entity separation for tax, AR aging, and consolidated reporting (e.g., separate audited P&Ls per entity), CTI will need to enable Zoho Books **Premium / Multi-Entity** ($60–$100/user/month delta over the existing Zoho One subscription) and migrate. This is a multi-day data project. Out of scope for this build, but flagged.

### Q14 — QBO
**No QBO connector is available in this Claude environment.** The Claude.ai connectors panel in this session exposes: Audible, Close, Day AI, Fireflies, Gamma, Gmail, Google Calendar, Google Drive, Jam, Jotform, Lucid, Microsoft 365, Omni Analytics, Zoho Books, Zoho CRM, Zoho Desk, Zoho Projects. **No QuickBooks Online.** No QBO refresh token, realm ID, or company info is visible anywhere in the Poseidon repo, the upchurch-financial-dashboard repo, or the proxy template.

**Decision:** Zoho Books is the sole accounting source for Phase 3. The Financial Dashboard will be built with a clean QBO adapter interface (`adapters/qbo.js`) that is **stubbed** — if Robert later attaches a QBO connector or provides a realm ID + OAuth refresh token, the adapter swaps in without touching dashboard code.

### Q28 — Zoho Recruit pipelines (full finding)
Robert does **not** use Zoho Recruit (separate product). The applicant pipeline lives in **Zoho CRM custom modules**. Relevant modules from `getModules` MCP call (102 total):

| Module API name | Display name | Likely role |
|---|---|---|
| `J1_Candidates` (CustomModule12) | J1 Candidates | Primary J-1 applicant store |
| `J1_Candidates1` (CustomModule14) | J1 Candidates. | Duplicate? Needs cleanup. |
| `J1_Participants1` (CustomModule22) | J1 Participants | Placed J-1s |
| `J1_Visa_Stage_One/Two/Three/Four` (CustomModule6/8/9/10) | Visa pipeline stages | Stage routing |
| `Candidates` (CustomModule13) | Candidates | Generic — likely Cruise candidates |
| `Hosting_Companies` (CustomModule18) | Hosting Companies | J-1 employers |
| `J1_Partners_Agents` (CustomModule20) | J1 Partners - Agents | Sponsor/agent registry |
| `J_1_Hospitalities_Bangkok` (CustomModule17) | Hospitalities Bangkok | Hospitality target list |
| `Institutions_of_Thailand` (CustomModule16) | Thai institutions | Source schools |
| `Organizational_Leads` (CustomModule15) | Org leads | B2B pipeline |
| `CUK_Placement` (CustomModule7) | CUK placement | Carnival UK placements |
| `J1_Visa_School_Partner` (CustomModule1) | J1 school partner | Source institutions |

**Decision (portal write-through):**
- **Cruise portal** → writes to `Candidates` (CustomModule13) with a custom field `Candidate_Type = "Cruise"` + the maritime document upload fields (`File_Upload_3__s` Seaman Book, `File_Upload_2__s` Marlins, `File_Upload_8__s` STCW etc.).
- **GHR/J-1 portal** → writes to `J1_Candidates` (CustomModule12) with `Stage = "Pre-application"`. Auto-flows to `J1_Visa_Stage_One` (CustomModule6) once the recruiter approves.
- **Land Hospitality** (Bangkok or future regions) → writes to a new module `Hospitality_Candidates` (CustomModule, to be created) OR to `Candidates` with `Candidate_Type = "Hospitality"`. ⚠ Confirm with Robert which: creating a new module costs nothing but adds maintenance surface; tagging in `Candidates` reuses what exists.

**Pipeline-IDs question is moot** — Zoho CRM doesn't expose pipelines on custom modules unless `multipipelines` feature is enabled. Each module's `Stage` picklist serves the same purpose. Agent D will list each module's `Stage` picklist values in the integration contract before writing portal forms.

---

## Best-judgment answers for unanswered questions

### Q2 — Missing prompt docs (`docs/SETUP.md`, `docs/SKILL.md`, `docs/JARVIS-KNOWLEDGE-BASE.md`)
**Default:** treat as renamings of existing files.
- `docs/SETUP.md` → `CLAUDE.md` (repo root) + `docs/cloudflare-worker-setup.md` together cover setup.
- `docs/SKILL.md` → `data/jarvis-skills/index.json` + the 6 per-domain skill JSON files.
- `docs/JARVIS-KNOWLEDGE-BASE.md` → `config/jarvis-memory.md`.

**Action:** create three thin pointer markdowns under `docs/` that link to the real sources. Avoids confusion in future prompts but doesn't duplicate content.

### Q7 — On-the-go editors
**Default:** github.dev (browser, any device), Claude Code on laptop, GitHub mobile app, Claude.ai with GitHub MCP. Add **VS Code Web** (`vscode.dev`) and **Cursor on iOS/Android** if Robert installs them. No code changes needed — these all just talk to GitHub.

### Q8 — Reserved 8th division
**Default:** render as `[Reserved Slot]` with a `cursor: not-allowed` style and tooltip "Reserved for 2026 expansion — name TBD." No data wiring.

### Q9 — Org chart rendering
**Default (recommend):** hand-drawn static SVG. ~6 KB, no CDN, scales perfectly, themable via CSS variables, screen-reader friendly with `<title>` and `<desc>`. Mermaid would add 30+ KB CDN + flash; d3 overkill. The hand-drawn SVG is committed to `docs/poseidon-org-mindmap.html`.

### Q11 — Version banner discrepancy
**Default:** `BASELINE.md` (v6.3.0) is authoritative. Update the J1 System inline banner from "5.0.0" to "v6.3.0" as a small `chore:` PR after the Master Dashboard lands. Not blocking.

### Q12 — Agents panel control
**Default:** status & last-run display only for v1. Adding "trigger run" buttons opens an authorization rabbit hole (who can trigger what, audit log, rate limiting) — defer to v2. Visual hint that says "Manual triggers coming in v2."

### Q15 — Books coverage for CTI Group Properties LLC + Win Makers
**Default:** display them on the Financial Dashboard with a "Manual / not yet connected" tile and a "Connect Zoho Books" button (no-op for now, surfaces an instruction modal). Encourages eventual connection without blocking the build.

### Q16/Q17 — Plaid environment + bank inventory
**Locked:** Sandbox → Development → Production, in that order, per Robert's answer. ⚠ **Production cost estimate:** Plaid pricing is **per linked Item**, not per account. Each "Item" = one bank login (which may cover multiple accounts at that bank). Production list price is **~$0.30/account/month for balance reads + ~$0.30 + $0.10/account/month for transactions**. For 7 entities × an estimated 2 banks each × ~2 accounts/bank = **~28 accounts → ~$17/month** on the Transactions product, **~$8/month** on Balance only. Surface again with exact account count once Plaid Link runs in Sandbox.

### Q18 — J-1 housing finance roll-up + partition
**Default:** the J1 System Dashboard exposes an aggregate-only endpoint (`/api/j1-housing-summary`) returning totals (total cash collected, outstanding rent, landlord payments YTD) — **no candidate names, no addresses, no per-candidate ledgers** cross the partition. Per-candidate ledgers stay inside J1. The Master Financial view sees only the rollup numbers. Same partition rule applies in reverse: cruise contract totals don't surface candidate-level data to anyone outside the Cruise namespace.

### Q19 — Biweekly PDF destination
**Default:** email to `ceo@cti-usa.com` (primary), stored to OneDrive `/POSEIDON/Financial Reports/<YYYY-MM-DD>.pdf`. CC to Sandra Watson (GRG CPA) and the bookkeeper is **optional and disabled by default** — opt-in via a Settings toggle. ⚠ Confirm CPA's email before enabling.

### Q20 — Tax module source
**Default:** lift the OBBBA section (anchor `#tax` and `#tax-2025`) from `upchurch-financial-dashboard/index.html` (the version banner is `v4.7.36`, dated 2026-05-10). Re-host as a partial under `cti-financial-dashboard.html` with the existing CTI styling. Treat as "extended" not "rebuilt."

### Q21 — Stripe
**Default:** skip for v1. Zoho Books already supports a "Pay Now" link on invoices. Add Stripe in a future iteration only if Zoho's payment processor cost is unacceptable.

### Q22 — Ad account access
**Default:** Marketing Dashboard ships with manual data entry (Robert types in spend) + read-only displays. Wire Meta Ads / Google Ads / LinkedIn Ads APIs in a follow-up Phase 5b once ad accounts are confirmed accessible.

### Q23 — Lead source attribution
**Default:** Marketing Dashboard reads UTM tags from new Leads (Zoho CRM `Leads` module). If the CRM doesn't currently capture UTM, Agent C adds a one-time workflow rule to populate `Lead_Source_Detail` from URL params. Backfill is impossible — only forward-looking attribution.

### Q24 — Content calendar source
**Default:** content calendar lives **inside** the Marketing Dashboard (single source of truth) and exposes an iCal feed (read-only) for anyone who wants to subscribe from Google Calendar or Outlook. No Notion/Trello dependency.

### Q25 — Google Drive folder IDs
**Default:** Agent C will use the existing Google Drive MCP `search_files` call to discover the folder IDs for "Voiceover", "B-Roll", and "Music Library" at runtime, then cache them in `config/drive-folder-ids.json`. ⚠ Verify folder names match — current names assumed from V6 references.

### Q26 — Podcast / YouTube analytics
**Default:** skip for v1. Manual entry of episode-level metrics. Wire YouTube Data API + a podcast host API (Buzzsprout / Transistor / Spotify for Podcasters) in Phase 5b.

### Q29 — Candidate tracking dashboard
**Default:** the portal **absorbs** the Hybrid Option B tracking dashboard. One repo per portal (`cti-cruise-portal`, `ghr-portal`), each shipping its own `/track/<token>` route. No separate tracker repo.

### Q30 — Document upload
**Default:** uploads land in **OneDrive `/POSEIDON/Applicant Documents/<entity>/<token>/`** via the existing Microsoft Graph scope upgrade pending in the user's CLAUDE.md (`Files.ReadWrite`). Token-named subfolder so a single candidate's files cluster. If the Azure scope hasn't been added when Agent D runs, Agent D will surface the exact consent URL and stub the upload UI with "coming soon — Azure consent pending."

### Q31 — Compliance copy
**Default:** Agent D drafts portal legal/privacy copy citing CTI Group Worldwide Services Inc., FL address, an info-only privacy statement (no GDPR-grade DPO yet — flag if EU candidate volume crosses 100/year), and the J-1 sponsor disclosures required by 22 CFR 62.31 (J-1 Cultural Exchange regs). ⚠ Final sign-off needed from CTI legal counsel before public launch.

---

## Material cost / compliance items to surface

1. **Plaid Production monthly cost ≈ $17/month at full coverage** (7 entities × 2 banks × 2 accounts assumed). Real number after Sandbox.
2. **Zoho Books Multi-Entity migration** would unlock true per-entity ledgers but adds ~$60–$100/user/month and a multi-day data project. Out of scope.
3. **GDPR posture** for the public portals if EU candidate volume crosses 100/year — needs a DPO appointment.
4. **CTI legal counsel sign-off** required on portal NDA / privacy / J-1 sponsor disclosure copy before public domain launch.
5. **Sandra Watson (GRG CPA) email** confirmation needed if biweekly PDF should auto-CC her.
6. **Azure `Files.ReadWrite` scope** is still pending from the 2026-04-25 CLAUDE.md action list — needed for portal document uploads.

---

*Defaults stay in force unless Robert pings back to override.*
