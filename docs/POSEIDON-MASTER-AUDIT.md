# Poseidon Master Dashboard — Phase 0 Audit

**Prepared by:** Implementor (Claude Code)
**For:** Robert Upchurch (Orchestrator, CEO CTI Group)
**Date:** 2026-05-11
**Source prompt:** `PROMPTS/POSEIDON-MASTER-DASHBOARD-CLAUDE-CODE-PROMPT.md`
**Status:** Phase 0 complete. Awaiting answers before Phase 1 (architecture doc) and subagent spawn (Agents A/B/C/D).

---

## 0. Headline findings (read first)

Three premises in the build prompt do not match the live system. Resolve these before any subagent writes code:

1. **There is no `poseidon-v6-backend` repo and no Vercel proxy.** The real backend for live data is a **Cloudflare Worker** (`poseidon-proxy.<subdomain>.workers.dev`) defined by `docs/cloudflare-worker-template.js` in the Poseidon repo. Its only routes are `/zoho/<module>`, `/walkscore`, `/zillow`, `/health`. **No QBO route. No Plaid route. No `/api/kpi-summary` contract.** Today's Zoho Books data in V6 actually comes from a static `config/zoho-books-snapshot.json` file regenerated externally by Cowork/Zoho MCP — not a live API call.
2. **Phase 0.5 (QBO entity check) is not executable as written.** There is no Vercel proxy QBO endpoint to hit. The Poseidon V6 dashboard does not call QuickBooks Online directly. If QBO is connected at all today, it's only through Claude's MCP layer at the Orchestrator's chat console — not from the dashboard.
3. **The three "existing repo" docs the prompt told me to read do not exist.** `docs/SETUP.md`, `docs/SKILL.md`, and `docs/JARVIS-KNOWLEDGE-BASE.md` are not in `github.com/Robert-Upchurch/Poseidon`. The closest analogs that DO exist are listed in §3.

Recommendation: keep the audit moving on the assumption that "the backend" means the Cloudflare Worker, and that QBO/Plaid are net-new connectors to build (not verify). Confirm before Phase 1.

---

## 1. Source-of-truth (Phase 0.25) result

| Path | State |
|---|---|
| `C:\Users\ceo\OneDrive\POSEIDON\Poseidon\` | **Does not exist.** No git clone here. |
| `C:\Users\ceo\OneDrive - CTI Group Worldwide Services Inc\POSEIDON\Poseidon-Dashboard-V5\` | Not a git repo. |
| `C:\Users\ceo\Poseidon\` | Symlink to business OneDrive `POSEIDON` folder. Not a git repo. |
| `C:\Users\ceo\Poseidon-Dashboard-V5\` | Empty shell (`.claude/` only). Not a git repo. |
| `github.com/Robert-Upchurch/Poseidon` | Canonical. Default branch `main`. Last push `2026-05-11T16:31Z`. Size 2.3 MB. |

There is no local clone anywhere of the canonical Poseidon repo. Robert is currently authenticated in `gh` as `Robert-Upchurch`. Token scopes already include `repo, workflow, gist, read:org`.

**Note on the prompt's GitHub-first rule:** the prompt instructs the working clone live inside OneDrive. The previous CLAUDE.md guidance (2026-04-25) deliberately kept the clone OUT of OneDrive because git's `.git/index` is highly write-active and OneDrive sync churns it. **Risk:** placing the working tree inside OneDrive can produce sync conflicts on `.git/index` and `.git/objects/pack/*` files, and may corrupt the repo if OneDrive flags a temp file mid-rebase. The mitigation is `excludePaths` for `.git/` in the OneDrive client. This needs an explicit Orchestrator decision — see Verification Question #1.

### One-paste PowerShell to set up the clone (run after the decision in Q1)

```powershell
# Clone Poseidon into personal OneDrive working folder
$dest = "C:\Users\ceo\OneDrive\POSEIDON\Poseidon"
if (Test-Path $dest) {
  Write-Host "Destination exists — aborting. Move/rename it first." -ForegroundColor Yellow
  return
}
git clone https://github.com/Robert-Upchurch/Poseidon.git $dest
Set-Location $dest
git remote set-url origin https://github.com/Robert-Upchurch/Poseidon.git
git fetch --all --prune
git checkout main
git pull --ff-only

# Recommend: tell OneDrive to ignore the .git directory to avoid sync corruption.
# (Manual step — Settings → OneDrive → Files Backup, exclude:
#   C:\Users\ceo\OneDrive\POSEIDON\Poseidon\.git
# Or use Files On-Demand "Always keep on this device" + "Free up space" toggles.)

Write-Host "`nClone ready at $dest" -ForegroundColor Green
Write-Host "Branches available:"
git branch -a
```

### Drift check

There is no current local working tree to diff against `main`. Once the clone is in place, the only files outside the repo that resemble dashboard work and could "drift" are:

- `C:\Users\ceo\OneDrive\POSEIDON\Poseidon-Dashboard\` — project hub (status notes, roadmap, partner-intake scaffold). Per the project hub README this is intentionally **not** in the repo. Treat as planning artifacts, not source code drift.
- `C:\Users\ceo\OneDrive\POSEIDON\Poseidon-Dashboard-Archive-2026-04-25\` — explicit archive. Ignore.
- `C:\Users\ceo\OneDrive - CTI Group Worldwide Services Inc\POSEIDON\Poseidon-Dashboard\` — older mirror of the same project hub. Ignore.

Conclusion: zero code drift. The repo is the only source for code.

---

## 2. QBO entity check (Phase 0.5) result

**Cannot execute as specified.** Detailed reasoning:

- The prompt assumes a Vercel-hosted `poseidon-v6-backend` exposing a QBO `CompanyInfo` endpoint. That backend does not exist (verified by listing all repos in the `Robert-Upchurch` GitHub account — 25 repos returned, none named `poseidon-v6-backend` and no Vercel proxy URL anywhere in dashboard JS).
- The actual deployed proxy is the Cloudflare Worker described in `docs/cloudflare-worker-setup.md`. Its routes are Zoho/Walkscore/Zillow only. No QBO.
- The Zoho Books module in the dashboard (`js/poseidon-modules/poseidon-zoho-books.js`) reads a static JSON snapshot, not a live API.

**What we DO know about the QBO situation** (collected from the upchurch-financial-dashboard repo):

- `upchurch-financial-dashboard` is the personal+CTI finance dashboard. It is a single static HTML file (`index.html`, ~627 KB) with hand-coded data arrays. Zero API calls to QBO.
- No `realmId`, `CompanyInfo`, or QBO OAuth tokens are referenced in any Poseidon repo file I can see.
- Robert is on **Zoho Books** for the 5 declared orgs. **No CTI entity has been confirmed as QBO-connected on the dashboard side.**

**Recommendation:** treat QBO as a net-new integration with two open questions (see Verification Questions Q14, Q15). If a CTI entity is actually live on QBO somewhere (e.g., the bookkeeper's seat), the realm ID + EIN-last-4 + entity name need to come from the Orchestrator — they cannot be discovered by code.

### What we know about the 5 Zoho Books orgs

From `js/poseidon-modules/poseidon-zoho-books.js` and `config/zoho-books-snapshot.json`: snapshot is keyed under `mcp__fb49e4b8-e4e9-46e1-9728-0f7072aa8de1__` and `organization_id 877439787` (= CTI Group Worldwide Services Inc., USD). The prompt names 5 orgs (`cti_group, ghr_j1, cti_marine, baron, uno`) but only **one** org_id (`877439787`) appears in the repo. The remaining four org_ids are not documented anywhere in code. → Verification Question Q13.

### Coverage gap vs. the 7 declared CTI entities

| # | Entity | Status |
|---|---|---|
| 1 | CTI Group Worldwide Services | Zoho Books org_id `877439787` confirmed |
| 2 | CTI Marine Travel | Listed in prompt as 5th Zoho org. **org_id not documented in repo.** |
| 3 | UNO (Uniforms Number One) | Listed in prompt. **org_id not documented in repo.** |
| 4 | Baron Promotions | Listed in prompt. **org_id not documented in repo.** |
| 5 | CTI Group Properties LLC | **Not in any Zoho list.** No connection documented. |
| 6 | Win Makers | **Not in any Zoho list.** No connection documented. |
| 7 | GHR / Global Human Resources | Prompt names "ghr_j1" Zoho org. **org_id not documented in repo.** |

Five of seven entities have no documented bookkeeping connection. → Verification Questions Q13, Q15.

---

## 3. Existing repo docs (Phase 0 step 2)

The prompt told me to read `docs/SETUP.md`, `docs/SKILL.md`, `docs/JARVIS-KNOWLEDGE-BASE.md` from the Poseidon repo. None exist. What does exist and was read instead:

| Path | Purpose |
|---|---|
| `CLAUDE.md` (repo root) | Project-at-a-glance, stack, file map, owner preferences, never/always rules. |
| `BASELINE.md` | Locked baseline v6.3.0 — protected files, allowed/forbidden changes, pre-flight checks, recovery commands. **The Master Dashboard build must respect this baseline — do not edit protected files without explicit instruction.** |
| `config/jarvis-memory.md` | Jarvis long-term memory seed (Robert, company, divisions, partition rule). |
| `data/jarvis-skills/index.json` | 6-domain skill registry: tax-compliance, recruiting-j1, cruise-staffing, ghr-platform, operations-process, marketing-bd. |
| `data/jarvis-skills/*.json` | Per-domain skill payloads. |
| `docs/cloudflare-worker-setup.md` | 5-minute Cloudflare Worker setup guide (the real proxy). |
| `docs/cloudflare-worker-template.js` | Worker code (Zoho/Walkscore/Zillow routes). |

---

## 4. Dashboard / asset inventory

### Live Poseidon V6 (`poseidon-dashboard-v6.html`, 528 KB)

| Section | Sub-page | Source |
|---|---|---|
| Master + Forecast | (KPI roll-up) | Inline data + snapshot files |
| Finance | (snapshot) | `config/zoho-books-snapshot.json` |
| Recruiting | overview, J1 cands, cruise cands, workflow, video req, production studio, files | Mostly inline + iframes |
| IT & Technology | (status) | Inline |
| Contracts | (cruise line) | iframe `contracts/index.html`, `contracts/analytics.html` |
| Jarvis Skills | tax, recruiting-j1, cruise-staffing, ghr-platform, operations-process, marketing-bd | `data/jarvis-skills/*.json` |
| Other | catch-all | Inline |
| Workspace | Home, Tasks, Calendar, Emails, Videos, Projects, Partners, J1 Housing Finder, Tracker | MSAL / Google MCP / iframes |

**Embedded iframes:** `j1-system-dashboard.html`, `j1-housing-finder-index.html`, `tracker.html`, `contracts/index.html`, `contracts/analytics.html`.

**External links / data:** Upchurch Financial Dashboard, Google Drive (voiceovers, B-roll, music), Microsoft 365 endpoints, Zoho Books snapshot, optional Cloudflare Worker.

### J1 System Dashboard (`j1-system-dashboard.html`, 608 KB)

Sidebar tabs: J1 Overview, Recruiting, J1 Division, Partner Onboarding, J1 Contract Analysis, J1 Housing Finder, Partners, Recruitment Videos, Other, Home, Tasks, Calendar, Emails, Settings.

iframes: `j1-housing-finder-index.html`, `robert-upchurch.github.io/cti-partner-onboarding/`, `robert-upchurch.github.io/cti-command-center/`.

External services referenced: Zoho Analytics (`analytics.zoho.com`), Zoho Recruit, Microsoft 365, Google Drive, ElevenLabs, Storyblocks.

Version banner: "5.0.0 / April 11 2026" (note: the underlying file was bumped to v6.3.0 in `BASELINE.md` but the inline banner text appears not updated. → Q11).

### Upchurch Financial Dashboard (`upchurch-financial-dashboard.pages.dev`)

10 nav groups, 31 anchors (Priority, Documents/Emails, 2025 Tax, CTI Operations, Debts & Cards, Properties, Plan, SBA, Completed, Summary). Hero version `v4.7.36` (May 10, 2026). Single static HTML, hand-coded data arrays, SHA-256 password gate. Deploy is Cloudflare Pages, not GitHub Pages.

### CTI Command Center (`robert-upchurch.github.io/cti-command-center/`)

8 sections: Dashboard, Provider Universe (154 J1 providers), Threat Matrix (top 30), Comparison, Fees, Breakdown, Radar, J-1 Statistics. Data: US State Dept FY2024 J-1 issuance + Google Sheets competitor dataset. Version `v3.1 / March 20, 2026`.

### Tracker (`tracker.html`)

Cross-division task tracker. GitHub API token + Issues sync. Lightweight — no backend.

---

## 5. Style fingerprint (extracted from v6 → to become Phase 1 deliverable)

These tokens will be saved as `docs/POSEIDON-STYLE-TOKENS.md` in Phase 1. Captured here so Agents A/B/C/D share one source.

- **Background:** `#0a1628` (navy)
- **Accent:** `#14b8a6` (teal-500)
- **Card surface:** `#0f1e2e` with border `zinc-700` / hover `zinc-500`
- **Glow:** `box-shadow: 0 0 40px rgba(20,184,166,0.15)`
- **Fonts:** Inter 400/500/600/700 (UI), JetBrains Mono 500/700 (data/code)
- **CDNs:** Tailwind via `cdn.tailwindcss.com`, Chart.js 4.4.0, MSAL 3.6.0, Lucide latest
- **Theme:** `class="dark"` toggle on `<html>`, `tailwind.config.darkMode='class'`, `localStorage` key `poseidon-theme`, pre-paint inline script to prevent flash
- **Layout:** left sidebar, top header (CTI logo right, assignment logo left), theme toggle in header
- **No build step:** single-file HTML
- **Icon set:** Lucide `data-lucide=""`

---

## 6. Cross-link map (who reads whom)

```
Poseidon V6  ←→  J1 System Dashboard       (BroadcastChannel cti-poseidon-sync + localStorage)
Poseidon V6  → embeds → tracker.html
Poseidon V6  → embeds → contracts/index.html, contracts/analytics.html
J1 System    → embeds → j1-housing-finder-index.html
J1 System    → embeds → cti-partner-onboarding (external repo)
J1 System    → embeds → cti-command-center (external repo)
Upchurch Financial → standalone (separate Cloudflare Pages deploy)
```

The strict partition rule is enforced both ways: Cruise/MLC stays on Poseidon V6, J-1 stays on the J1 System. v6.3.0 added `read_remote_dashboard` so Jarvis can speak across the two dashboards without breaking the partition.

---

## 7. Gap list — things asked for that don't yet exist anywhere

| # | Asked for | Proposed home |
|---|---|---|
| G1 | Org mind map / hierarchy SVG | New `docs/poseidon-org-mindmap.html` (Phase 2) |
| G2 | `poseidon-master-dashboard.html` | New file at repo root (Phase 3 — Agent A) |
| G3 | `cti-financial-dashboard.html` | New file at repo root, replaces/augments `upchurch-financial-dashboard.pages.dev` (Phase 4 — Agent B) |
| G4 | `cti-marketing-dashboard.html` | New file at repo root (Phase 5 — Agent C) |
| G5 | Cruise Web Portal | New repo `cti-cruise-portal` (Phase 6 — Agent D) |
| G6 | GHR Web Portal | New repo `ghr-portal` (Phase 6 — Agent D) |
| G7 | `/api/kpi-summary` contract per divisional dashboard | Extend Cloudflare Worker (no Vercel) — new `INTEGRATION-CONTRACT.md` |
| G8 | Plaid connector | Add `/plaid/*` routes to Cloudflare Worker, plus `PLAID_*` secrets |
| G9 | QBO connector (if Robert actually has a QBO entity) | Add `/qbo/*` routes to Cloudflare Worker |
| G10 | Stripe (optional) | Hold pending Q21 |
| G11 | `docs/SETUP.md`, `docs/SKILL.md`, `docs/JARVIS-KNOWLEDGE-BASE.md` | Create or rename — current analogs are `CLAUDE.md`, `data/jarvis-skills/*`, `config/jarvis-memory.md` |
| G12 | Biweekly automated full-financial PDF | New Worker cron + PDF render path (no existing infra) |
| G13 | `docs/POSEIDON-MASTER-ARCHITECTURE.md` | Phase 1 deliverable |
| G14 | `docs/AGENT-LOG.md` | Created when subagents spawn |
| G15 | Light/dark mode on every new artifact | Hard requirement per global CLAUDE.md |

---

## 8. Risks surfaced (one line each, per Execution Mode rule)

- **R1.** Placing the git working tree inside OneDrive risks `.git/index` corruption from sync — mitigation requires explicit OneDrive exclusion.
- **R2.** The build prompt's backend description (Vercel/poseidon-v6-backend) does not match the live stack (Cloudflare Worker). Subagents will fail Day 1 if they take the prompt literally.
- **R3.** Only one of seven CTI entities has a documented bookkeeping connection — the Financial Dashboard cannot reach "every entity" until org_ids and any QBO realm IDs are surfaced.
- **R4.** Plaid Production access requires Plaid review (often 1–3 weeks). Treat as out of scope for the first build; ship on Sandbox, gate the live switch.
- **R5.** Inline version banners (e.g., v5.0.0 in J1 System) disagree with the locked `BASELINE.md` v6.3.0. Source-of-truth ambiguity for "current version."
- **R6.** `BASELINE.md` forbids refactoring v6 layouts. If the Master Dashboard demands changing v6's nav contract, this baseline must be explicitly lifted.
- **R7.** Embedding J1 System full-page (no iframe) means deep-linking with route preservation — must not break the partition firewall in localStorage (snapshots can leak J-1 data into Poseidon's namespace if not scoped).
- **R8.** Spawning 4 parallel subagents (A/B/C/D) all editing the same repo is OK on isolated feature branches, but their shared `/api/kpi-summary` contract must be written and locked **before** spawn or merges will conflict.
- **R9.** Both new public portals must enforce the partition rule at the Zoho Recruit pipeline level — needs Recruit module names + pipeline IDs.
- **R10.** Stripe optional path not yet decided — flag before any payment UI.

---

## 9. Verification questions — grouped by which Agent needs the answer

These are the questions that must be answered before Phase 1 starts. **Phase 1 (architecture doc) and subagent spawn will not begin until these are resolved.**

### CROSS-CUTTING — answer before anything

**Q1. Git clone location.** The Orchestrator's 2026-05-11 directive says place the clone inside OneDrive (`C:\Users\ceo\OneDrive\POSEIDON\Poseidon\`). The 2026-04-25 CLAUDE.md says do not, because OneDrive sync corrupts `.git/`. Three options:
  a) Personal OneDrive + exclude `.git/` from sync (recommended — only OneDrive folder Claude can write to)
  b) Business OneDrive + exclude `.git/` from sync (matches global CLAUDE.md "canonical" rule but business OneDrive is declared inaccessible to this Claude session)
  c) Outside OneDrive at `C:\Users\ceo\Poseidon\` and rely on git push/pull for cross-device sync (safest for git, loses OneDrive auto-sync)

**Q2. "Existing repo" docs (`docs/SETUP.md`, `docs/SKILL.md`, `docs/JARVIS-KNOWLEDGE-BASE.md`).** They don't exist. Did the prompt mean (a) `CLAUDE.md` + `BASELINE.md` + `config/jarvis-memory.md` + `data/jarvis-skills/`, or (b) we should create the three new files as Phase 0.6 before Phase 1?

**Q3. The "backend" — Vercel vs. Cloudflare Worker.** Confirm we proceed against the Cloudflare Worker `poseidon-proxy` and ignore the prompt's Vercel references. If Robert wants Vercel after all, that adds new repo + new deploy + new auth model (and probably moves Zoho/Plaid/QBO logic into Node ESM instead of Worker runtime).

**Q4. Worker subdomain.** What is the live worker URL (`poseidon-proxy.<subdomain>.workers.dev`)? Needed so subagents can call existing `/health` and `/zoho/*` and add `/api/kpi-summary` cleanly.

**Q5. BASELINE.md exception.** The Master Dashboard build will need to add new files, possibly link from v6 nav, and may need to evolve `poseidon-jarvis-grok.js`. Confirm the baseline is lifted **for these specific changes** (new files only) but stays in force for everything else.

**Q6. Auth model for the Master.** Today V6 uses MSAL + a client-side password gate. Should the Master Dashboard reuse the same gate, add Microsoft Entra SSO, or add Auth0 / Clerk? Same question for the Cruise/GHR public portals (where most users are unauthenticated candidates).

**Q7. Cross-device on-the-go editing.** Confirm the four target editors named in the prompt (github.dev, Claude Code, GitHub mobile app, Claude.ai+GitHub MCP). Any others?

---

### AGENT A — Master Dashboard Builder

**Q8. Reserved 8th division — placeholder name?** The hierarchy lists 7 divisions + 1 reserved. Show as "Reserved" or skip?

**Q9. Org chart rendering.** Lightweight static SVG (hand-drawn, ~5 KB) vs. mermaid (~30 KB CDN) vs. d3-mini (~200 KB)? Recommend hand-drawn SVG to stay no-build, no-CDN-tax.

**Q10. J1 System "full page, no iframe."** Implementation choice: (a) external link in nav that opens `j1-system-dashboard.html` in the same tab, replacing the Master shell, or (b) Master shell loads J1 as a single-page route, keeping the sidebar visible. Recommend (a) for true viewport reclaim per prompt, with a "Back to Master" pill button on J1 that already exists.

**Q11. Version banner discrepancy.** J1 System inline banner says v5.0.0 but `BASELINE.md` says v6.3.0. Which one is authoritative for the Master roll-up?

**Q12. Agents panel — display only or also control?** Just status & last-run, or also "trigger run" buttons (which would need an auth wall)?

---

### AGENT B — Financial Dashboard Builder

**Q13. Zoho Books org_ids for the other 4 orgs.** Confirmed: CTI Group `877439787`. Need: `ghr_j1`, `cti_marine`, `baron`, `uno`. Each org needs its own org_id + (likely) its own OAuth scope set.

**Q14. QBO realm — does a CTI entity actually use QBO today?** If yes, which one, and where does the realm ID + access token currently live (bookkeeper's QBO seat? Intuit Developer console?). If no, deprioritize QBO and focus on Zoho.

**Q15. Books coverage for the remaining entities.** CTI Group Properties LLC and Win Makers have no documented Zoho or QBO. Are they on bookkeeping software at all? Excel? Recommend addressing this gap on the Financial Dashboard with a clearly labeled "manual / no live feed" tile until connected.

**Q16. Plaid environment.** Start in Sandbox (no real bank data, 1-day setup) or push directly to Development (real bank data, 5 connected accounts max, ~3 days)? Production access requires Plaid review (1–3 weeks).

**Q17. Bank inventory.** How many bank accounts across the 7 entities, and at which institutions? Plaid's monthly billing is per linked account, so this is a real cost decision.

**Q18. J-1 housing finance roll-up.** The J1 System Dashboard owns housing data — what's the contract for pulling per-candidate ledgers up to the Master Financial view without violating the partition rule? Propose a one-way read of aggregate totals only (no candidate names on the cruise side).

**Q19. Biweekly automated PDF — destination.** Email to `ceo@cti-usa.com` only, or also to Sandra Watson (GRG CPA) and the bookkeeper? Where stored — OneDrive `/Financial Reports/` or Zoho Workdrive?

**Q20. Tax module — what's "extend, don't rebuild"?** The prompt says OBBBA + Florida + 2026 calendar already in `docs/SETUP.md`. That doc doesn't exist. Confirm the source (might be the OBBBA section in `upchurch-financial-dashboard` `index.html` anchor `#tax`).

**Q21. Stripe optional.** Add card-payment buttons to Zoho invoices? Or skip?

---

### AGENT C — Marketing Dashboard Builder

**Q22. Ad account access.** Which Meta / Google / LinkedIn ad accounts can the dashboard read? Without API access we can show campaign metadata only, not real spend.

**Q23. Lead-source-attribution canonical store.** Does Zoho CRM currently capture UTM tags / lead source on every Lead record? Cleanup needed before "every candidate tagged back to source" is real.

**Q24. Content calendar source.** Built into the dashboard, or read from an existing tool (Notion, Google Sheets, Trello, Buffer, Hootsuite)?

**Q25. Asset library — Google Drive folder IDs.** Voiceover, B-Roll, Music Library folder IDs needed. Recommend listing them in `docs/POSEIDON-MASTER-ARCHITECTURE.md` once known.

**Q26. Podcast / YouTube analytics.** Which platforms (Spotify for Podcasters, Buzzsprout, YouTube Studio)? Each has its own auth.

---

### AGENT D — Portal Builder

**Q27. Domain decisions.**
  - Cruise Portal: `cti-usa.com/cruise/` (path on existing site) vs `cruise.cti-usa.com` (subdomain) vs GitHub Pages subdomain. WordPress on cti-usa.com complicates path-based hosting.
  - GHR Portal: `globalvisajobs.com` or `hospitalityfasttrack.com`? Are both domains owned and DNS-active?

**Q28. Zoho Recruit pipeline IDs.** Need the exact Cruise pipeline ID + the J-1 pipeline ID + the Land Hospitality pipeline ID so portal form submits land in the right lane.

**Q29. Candidate tracking dashboard for the public portal.** The prompt's earlier "Hybrid Option B" decision (tracking token at `cti-usa.com/track/{token}`) — does the new portal absorb that or stay separate?

**Q30. Document upload.** Portals need resume + photo + (J-1) passport scan upload. Where stored? OneDrive `/Applicant Documents/` (Azure scope upgrade required per CLAUDE.md pending action #2) or Zoho Workdrive?

**Q31. Compliance copy.** Who signs off on legal/privacy copy for the public portals (NDA, GDPR if EU candidates, J-1 sponsor disclosures)?

---

## 10. What happens after these answers

Once Q1–Q31 are answered:

1. I write `docs/POSEIDON-MASTER-ARCHITECTURE.md` (Phase 1) — hierarchy mermaid, dashboard ownership map, data flow, auth model, partition rules, refresh cadence.
2. I lock `docs/INTEGRATION-CONTRACT.md` — `/api/kpi-summary` schema + auth + TTL.
3. I write `docs/poseidon-org-mindmap.html` (Phase 2).
4. I spawn Agents A, B, C, D on isolated feature branches (`feat/master`, `feat/finance`, `feat/marketing`, `feat/portals`).
5. Joint integration check before any merge to `main`.

**Until Q1–Q31 are resolved, no dashboard code will be written and no subagents will be spawned.**

---

*End of Phase 0 audit.*
