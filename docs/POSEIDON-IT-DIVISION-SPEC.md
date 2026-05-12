# Poseidon IT Division Dashboard — Architecture Spec

**Status:** Draft for review — Putu Astra (Zoho admin lead) + Chendra (IT support) + Robert (approver)
**Date:** 2026-05-12
**Author:** Claude (drafted from Robert's spec)
**Build target:** Next Claude Code session

---

## 1. Purpose

A two-way bridge between Robert's executive workflow and the CTI IT team's ticketing system.

- **Robert's interface:** Poseidon IT Division dashboard tab (same dark navy/teal Poseidon styling, embedded in Master dashboard family)
- **IT team's interface:** Zoho Desk (their existing/native ticketing system, desktop + mobile apps)
- **Bridge:** Cloudflare Worker routes that sync tickets, replies, and status between the two

The result: Robert drops a request into Poseidon IT; Putu Astra and Chendra see it in their normal Zoho Desk inbox; their replies appear back in Poseidon IT.

---

## 2. Why this architecture

| Need | How it's met |
|---|---|
| Single executive interface for Robert | Poseidon IT Division tab — bespoke view |
| Battle-tested ticketing for IT team | Zoho Desk — mature product, mobile apps, SLA, audit log |
| Two-way conversation | Cloudflare Worker proxies Zoho Desk API both directions |
| Mobile access for IT | Zoho Desk mobile app (no custom mobile build) |
| Audit trail | Zoho Desk native audit log captures everything |
| No vendor lock-in | All ticket data lives in Zoho Desk — Robert owns it |
| Consistent visual language | Poseidon dark theme, navy #0a1628, teal #14b8a6, Inter font |

---

## 3. User flows

### 3.1 Robert drops a new IT request

1. Robert opens Poseidon → **IT Division** tab
2. Clicks **+ New Request** button (top-right)
3. Modal opens:
   - **Title** (required, text)
   - **Description** (required, markdown supported)
   - **Category** (dropdown — see section 6)
   - **Priority** (Critical / High / Medium / Low)
   - **Assign to** (Putu Astra / Chendra / Both / Unassigned)
   - **Link to context** (optional URL — audit doc, agent log entry, etc.)
   - **Requires Robert approval** (checkbox — yes/no)
4. Robert clicks **Submit**
5. Worker `POST /api/it-issues/create` → Zoho Desk API → ticket created in CTI IT Support department
6. Putu Astra and/or Chendra receive Zoho Desk mobile push notification within seconds
7. New ticket appears in Robert's Poseidon IT dashboard as `Open — Awaiting IT`

### 3.2 IT team replies in Zoho Desk

1. Putu Astra opens Zoho Desk mobile or web → CTI IT Support inbox
2. Sees new ticket from Robert
3. Replies (text, attaches files, sets status)
4. Optionally marks status: `In Progress`, `Awaiting Robert`, `Resolved`
5. Zoho Desk records reply timestamp and status change

### 3.3 Robert sees reply

1. Poseidon IT dashboard polls `/api/it-issues/list` every 30 seconds
2. Ticket row updates: status changes from `Awaiting IT` to `New Reply` (visual flag)
3. Robert clicks the ticket → detail drawer slides in from right
4. Sees full conversation thread, latest reply highlighted
5. Reply box at bottom — Robert types a reply, clicks **Send**
6. Worker `POST /api/it-issues/reply` → Zoho Desk API → reply added to ticket conversation
7. Putu Astra/Chendra notified on their side

### 3.4 Robert approves and closes

1. When IT marks ticket `Awaiting Robert` (e.g., "permission granted — please verify")
2. Robert verifies on his end
3. Clicks **Approve & Close** button on the ticket detail drawer
4. Worker `POST /api/it-issues/close` → Zoho Desk status set to `Resolved`
5. Ticket moves to `Closed This Week` KPI tile

---

## 4. Single source of truth

**Zoho Desk holds all ticket data.** The Worker is stateless (no ticket data in Cloudflare KV). Poseidon IT is a custom view of Zoho Desk data with quick-create tailored to Robert's workflow.

This means:
- If Putu Astra updates a ticket directly in Zoho Desk → Robert's dashboard reflects it on next poll
- If Poseidon dashboard is down → IT can still work normally in Zoho Desk
- If Robert exports Zoho Desk data → he has the complete record
- No data duplication, no sync conflicts

---

## 5. Backend architecture

### 5.1 Cloudflare Worker routes

| Route | Method | Direction | Purpose |
|---|---|---|---|
| `/api/it-issues/list` | GET | Desk → Poseidon | Ticket list + KPI counts |
| `/api/it-issues/:id` | GET | Desk → Poseidon | Single ticket detail + full conversation |
| `/api/it-issues/create` | POST | Poseidon → Desk | New ticket from Robert's form |
| `/api/it-issues/reply` | POST | Poseidon → Desk | Robert's reply to existing ticket |
| `/api/it-issues/close` | POST | Poseidon → Desk | Mark ticket Resolved |
| `/api/it-issues/reopen` | POST | Poseidon → Desk | Reopen a closed ticket |

All routes auth via existing `X-Dashboard-Token` header; CORS locked to `robert-upchurch.github.io`.

### 5.2 Zoho Desk OAuth

- New Self Client refresh token (separate from CRM and Recruit tokens)
- Scope: `Desk.tickets.ALL,Desk.contacts.ALL,Desk.settings.READ,Desk.search.READ`
- Worker secrets to add:
  - `ZOHO_DESK_CLIENT_ID`
  - `ZOHO_DESK_CLIENT_SECRET`
  - `ZOHO_DESK_REFRESH_TOKEN`
  - `ZOHO_DESK_ORG_ID` (queryable via `/api/v1/organizations`)
  - `ZOHO_DESK_DEPT_ID` (CTI IT Support department ID)

### 5.3 Zoho Desk → Poseidon polling

- Dashboard polls `/api/it-issues/list` every 30 seconds when tab is active
- Includes `If-Modified-Since` header for efficient revalidation
- On reply detected: subtle teal pulse animation on the affected row + sound (optional, off by default)

### 5.4 Optional Phase 2: webhooks instead of polling

Zoho Desk supports outbound webhooks. Phase 2 enhancement:
- Configure Zoho Desk to webhook the Worker on ticket update events
- Worker pushes to dashboard via Cloudflare Durable Objects or SSE
- Eliminates polling, makes updates instant

Defer to Phase 2 — polling is fine for v1 with low ticket volume (~10-50/month).

---

## 6. Ticket categorization

Categories defined by Robert's IT request patterns. Each maps to a Zoho Desk ticket category.

| Category | Examples |
|---|---|
| **Zoho Permissions** | "Grant OAuth user access to Recruit J1_Candidates" |
| **Module Access** | "Investigate CRM Candidates locked module" |
| **Integration / API** | "Worker portal-intake to Recruit retargeting" |
| **Dashboard Issue** | "Marketing KPIs not refreshing" |
| **System Fix** | "Cloudflare Worker 500 error on /api/kpi-summary" |
| **Architecture Decision** | "Should J-1 portal write to J1_Candidates or Applications?" |
| **Account Setup** | "Add new user to Zoho One" |
| **Other / IT Q** | catchall |

Custom fields on each ticket (Zoho Desk supports custom fields):
- `Affected System` (Zoho CRM / Zoho Recruit / Zoho Books / Zoho Desk / Poseidon Worker / Dashboard / Other)
- `Linked Doc` (URL — audit doc, agent log, GitHub commit, etc.)
- `Requires Robert Approval` (Yes/No)

---

## 7. Priority and SLA

| Priority | Definition | SLA target |
|---|---|---|
| **Critical** | Production system down, blocking revenue or data loss | 4 business hours |
| **High** | Blocks Robert's work or a customer-facing feature | 1 business day |
| **Medium** | Affects internal efficiency, no customer impact | 3 business days |
| **Low** | Investigation, documentation, future planning | 1 week |

Configurable in Zoho Desk → Workflows → SLA. Defer SLA configuration to Phase 2 if Putu Astra and Chendra prefer to start without strict SLAs.

---

## 8. UI design — Poseidon IT Division tab

### 8.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Poseidon Master Dashboard                                  [⚙]   │
│ ┌─────────┬─────────┬─────────┬───────────┬────────────────────┐│
│ │ Master  │ Finance │ Marketing│ Portals  │ IT Division  ◀ NEW ││
│ └─────────┴─────────┴─────────┴───────────┴────────────────────┘│
│                                                                  │
│   IT DIVISION                                  [+ New Request]   │
│                                                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │ OPEN     │ │ AWAITING │ │ AWAITING │ │ RESOLVED │          │
│   │   7      │ │ THEIR    │ │ ROBERT   │ │ THIS WK  │          │
│   │          │ │ REPLY 3  │ │   2      │ │   12     │          │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│   FILTERS: [Open] [New Reply] [Awaiting Me] [Resolved] [All]    │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ #1234  Grant OAuth access to Recruit J1_Candidates       │ │
│   │        Zoho Permissions • High • Putu Astra • 2h ago     │ │
│   │        🟢 New Reply                                       │ │
│   ├──────────────────────────────────────────────────────────┤ │
│   │ #1233  Investigate CRM Candidates locked module          │ │
│   │        Module Access • Medium • Putu Astra • 1d ago      │ │
│   │        ⚪ Awaiting IT                                     │ │
│   ├──────────────────────────────────────────────────────────┤ │
│   │ #1232  Land_Based module activation decision             │ │
│   │        Architecture • Low • Both • 3d ago                │ │
│   │        🟡 Awaiting Robert                                 │ │
│   └──────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Ticket detail drawer (right slide-in panel)

- Full conversation thread (Robert messages right-aligned teal, IT messages left-aligned navy)
- Each message: author, timestamp, body (markdown rendered), attachments
- Reply box at bottom (markdown supported, file attach button)
- Action buttons in header: **Approve & Close** / **Reopen** / **Set Priority** / **Reassign**
- Metadata sidebar (right edge of drawer): Status, Priority, Category, Assigned To, Created, Last Updated, Linked Doc

### 8.3 Visual language

Match existing Poseidon dashboards:
- Background: `#0a1628`
- Panels: `#0f1e2e`
- Cards: `#122336`
- Primary accent (Robert's actions, KPI highlights): teal `#14b8a6`
- Status colors:
  - Open / Awaiting IT: gray `#6b7280`
  - New Reply: green `#10b981`
  - Awaiting Robert: amber `#f59e0b`
  - Resolved: teal `#14b8a6` (muted)
- Font: Inter (UI), JetBrains Mono (ticket IDs, code blocks)
- Mobile responsive at 768px breakpoint

---

## 9. Phase 0 — IT team setup (Robert + Putu Astra)

Before any code is written, the following Zoho Desk setup must be done:

| Step | Who | What | Where |
|---|---|---|---|
| 1 | Robert | Confirm Putu Astra and Chendra have Zoho Desk licenses assigned in Zoho One | one.zoho.com → Users |
| 2 | Robert | If not assigned, assign Desk licenses to both | one.zoho.com → User Management |
| 3 | Robert | Open Zoho Desk → Setup → Departments | desk.zoho.com |
| 4 | Robert | Create department "CTI IT Support" | Setup → Departments → New |
| 5 | Robert | Add agents: Putu Astra (Lead), Chendra (Support), Robert (Watcher) | Department → Members |
| 6 | Robert | Set Putu Astra as default assignee for "Zoho Permissions", "Module Access", "Integration / API" categories | Department → Assignment Rules |
| 7 | Robert | Set Chendra as default assignee for "Dashboard Issue", "System Fix", "Account Setup" | Department → Assignment Rules |
| 8 | Robert | Create custom fields on tickets: Affected System (dropdown), Linked Doc (URL), Requires Robert Approval (checkbox) | Department → Layouts → Fields |
| 9 | Robert | Add reply email address (e.g., it-support@cti-usa.com) — optional but recommended | Department → Channels → Email |
| 10 | Robert | Brief Putu Astra and Chendra on the workflow (5-min call or message) | — |

Estimated time: **15-20 minutes** if Desk licenses already assigned, +5 minutes per user if not.

---

## 10. Phase 1 — OAuth + Worker secrets (Robert + Claude Code)

Same flow as today's CRM and Recruit OAuth:

1. Robert opens api-console.zoho.com → existing Self Client → Generate Code tab
2. Scope: `Desk.tickets.ALL,Desk.contacts.ALL,Desk.settings.READ,Desk.search.READ`
3. Time Duration: 10 minutes
4. Click CREATE, copy code, paste to Claude Code as `DESK_CODE=1000.xxx...`
5. Claude Code exchanges code for refresh token
6. Claude Code runs `wrangler secret put` for all 5 Desk secrets
7. Claude Code queries Zoho Desk `/api/v1/organizations` to get `orgId`, stores as secret
8. Claude Code queries `/api/v1/departments` to find "CTI IT Support" deptId, stores as secret

Estimated time: **10 minutes.**

---

## 11. Phase 2 — Worker routes (Claude Code only)

Implement the 6 routes from section 5.1. Each route:
1. Validates `X-Dashboard-Token` (existing pattern)
2. Refreshes Zoho Desk access token using refresh token
3. Calls Zoho Desk API with appropriate headers and body
4. Returns JSON response in Poseidon's standard shape: `{ ok: true, data: ..., source: 'zoho-desk' }`
5. Errors return `{ ok: false, error: '...', code: 'string' }`

Reuse existing patterns from `/api/portal-intake` and `/api/kpi-summary`.

Estimated time: **2 hours** of Claude Code work.

---

## 12. Phase 3 — Poseidon IT Division tab (Claude Code only)

Create new file `poseidon-it-division.html` OR add new tab to `poseidon-master-dashboard.html` (Robert's call — recommend separate file for now, can be embedded in Master tab later).

Components:
- Header with KPI tiles (4)
- Filter bar
- Issues table with sort + pagination
- "+ New Request" button → modal
- Ticket detail drawer (right slide-in)
- Reply composer in drawer
- Action buttons in drawer

Reuse Poseidon design tokens from `docs/POSEIDON-STYLE-TOKENS.md`. Tailwind CDN + Chart.js + Lucide icons.

Estimated time: **3 hours** of Claude Code work.

---

## 13. Phase 4 — Seed tickets + verify two-way flow (Claude Code + Robert)

1. Claude Code reads `docs/ZOHO-OPEN-QUESTIONS.md`
2. Creates 8 tickets in Zoho Desk via Worker route (one per question)
3. Each ticket:
   - Title: question summary
   - Description: full question text + evidence + link to audit doc
   - Category: appropriate mapping (Zoho Permissions, Module Access, etc.)
   - Priority: per question urgency
   - Assigned to: Putu Astra (Q5, Q7), Chendra (none yet), Both (Q6, Q8), Eduardo (Q1-Q4 via email since Eduardo isn't on Desk)
4. Robert verifies tickets appear in Poseidon IT dashboard
5. Putu Astra confirms they appear in Zoho Desk
6. Putu Astra replies to one ticket as a test
7. Robert verifies reply appears in Poseidon IT dashboard within 30s poll
8. Robert replies back; Putu Astra verifies it appears in Zoho Desk
9. End-to-end flow confirmed

Estimated time: **20 minutes.**

---

## 14. Open questions for Putu Astra and Chendra

Send this doc to them with these questions:

- **Q1.** Are you OK with Zoho Desk as the ticketing tool, or do you have a preference for a different system already in use?
- **Q2.** Do you want SLA timers enabled from day one, or start without and add later?
- **Q3.** Email integration — should ticket replies also email you, or rely on Zoho Desk mobile push only?
- **Q4.** Categories proposed in section 6 — anything to add, remove, or rename?
- **Q5.** Assignment rules in section 9.6-9.7 — do those assignee defaults match how you'd want work routed?
- **Q6.** Are you on Zoho One already with Desk licenses assigned, or does Robert need to assign them?
- **Q7.** Any concerns about the read-only Zoho audit findings from 2026-05-12 that need urgent attention before this build?

---

## 15. Estimated total build time

| Phase | Who | Time |
|---|---|---|
| 0 — Desk setup | Robert | 15-20 min |
| 1 — OAuth | Robert + Claude Code | 10 min |
| 2 — Worker routes | Claude Code | 2 hr |
| 3 — Dashboard tab | Claude Code | 3 hr |
| 4 — Seed + verify | Claude Code + Robert | 20 min |
| **Total** | | **~6 hr Claude Code + ~30 min Robert, spread over 1-2 sessions** |

---

## 16. Decisions Robert needs to make before build starts

| Decision | Default | Robert's pick |
|---|---|---|
| New dashboard file or new tab on Master? | Separate file `poseidon-it-division.html`, link from Master | TBD |
| Email address for Desk replies? | `support@cti-usa.com` or new `it-support@cti-usa.com` | TBD |
| Eduardo gets Desk license too? (so he can be assigned ops tickets) | No (keep IT-only for now, email him separately) | TBD |
| SLA enabled from day 1? | No (start without, add Phase 2) | TBD |
| Webhooks vs polling? | Polling (Phase 2 = webhooks) | TBD |

---

## 17. Resume instructions for next Claude Code session

```
Resume Poseidon. Read docs/POSEIDON-IT-DIVISION-SPEC.md.

I have approved [the spec / sections X-Y / with these changes: ...].

Phase 0 status: [done / in progress / not started]
Phase 1 OAuth: [DESK_CODE here if ready, or "need to generate"]

Begin with Phase [N].
```

---

*End of spec. Pending Robert + Putu Astra + Chendra review.*
