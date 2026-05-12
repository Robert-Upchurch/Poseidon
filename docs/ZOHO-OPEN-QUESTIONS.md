# Zoho Open Questions — Stakeholder Briefing

**Date:** 2026-05-12
**Source:** `docs/ZOHO-ARCHITECTURE-AUDIT-2026-05-12.md` (full audit)
**Status:** Awaiting answers before any Worker wiring changes proceed.

This is a one-page briefing aid for Robert's conversations with
Eduardo (J-1 VP) and the IT team. It captures only the **decisions
needed** — the audit doc has the full evidence behind each.

---

## For Eduardo (J-1 VP)

### Q1. Canonical J-1 system

> **Which Zoho system does your J-1 ops team actually use day-to-day
> for the ~1,040 active participants — Recruit `J1_Participants` or
> CRM `J1_Candidates`?**

**Why we're asking:** The GHR Web Portal currently posts new J-1
intakes to **CRM `J1_Candidates`**. The Recruit `J1_Participants`
custom module has **1,040 records and 109 fields** of operational
lifecycle (4-stage investment, hosting company, sponsor interview,
visa, flights, housing). If recruiters work in Recruit, the portal is
writing to the wrong system.

**What I need from you:**
- Day-to-day workflow truth: where do recruiters check new
  applications and update statuses?
- Are CRM `J1_Candidates` and Recruit `J1_Participants` intended as
  two stages of one pipeline (lead → processing), or are they
  duplicate systems?
- If we redirect the portal to Recruit, what do we do with the existing
  CRM `J1_Candidates` records?

### Q2. Land_Based custom module purpose

> **Is the `Land_Based` custom module in Recruit intended for
> hospitality land placements?**

**Why we're asking:** It exists in Recruit (UI label "Land Based") but
has zero records. It looks provisioned but unused. If it is meant for
land hospitality, that may be the eventual home for those GHR portal
applicants who select track = "Land Hospitality" instead of "Cultural
Exchange."

**What I need from you:**
- Confirm intent of the module
- If unused, should it be activated / archived / repurposed?

---

## For IT Team

### Q3. CRM `Candidates` module — owner, origin, lockout

> **Who created the CRM `Candidates` custom module (CustomModule13),
> when, and why is it locked from the Administrator profile?**

**Why we're asking:** This is the module the Worker currently targets
for cruise intakes (and it's failing with `NO_PERMISSION`). When we
queried via OAuth using the Administrator-level credentials Robert
authenticated with, **even module metadata access was denied** — not
just record reads. That's an unusual lockdown for an Admin profile.

**Evidence in the audit:**
- `GET /crm/v6/Candidates` → `NO_PERMISSION`
- `GET /crm/v6/settings/modules/Candidates` → `NO_PERMISSION`
- Module appears in the broader modules list with
  `generated_type: custom` — so it exists, but is walled off.

**What we need from IT:**
1. Who created the module and on what date?
2. Which profile(s) currently have access? (Likely none, given the
   Admin lockout.)
3. Are there any records in it? If so, how many and how old?
4. Does any workflow, integration, Flow rule, or dashboard reference
   it?
5. **Recommended action:** archive, delete, or repurpose?

This investigation has to happen inside Zoho CRM Setup with a user
that has full org access — the OAuth path is blocked.

### Q4. CRM `J1_Candidates` — origin and current usage

> **Is the CRM `J1_Candidates` module actively used, or is it a
> vestigial parallel to Recruit `J1_Participants`?**

**Why we're asking:** GHR portal writes succeed to this module (we
confirmed today with test record `98ac7817-...`). But if Eduardo's
team works in Recruit (Q1 above), then this CRM module is collecting
data nobody reads.

**What we need from IT:**
- Record count in CRM `J1_Candidates`
- Last modified date (any human activity in the last 90 days?)
- Any Flow rules, blueprints, or assignment rules pointing at it?
- Same archive/delete/repurpose recommendation if it turns out to be
  vestigial.

---

## Added 2026-05-12 (Section 2 Deep-Scan)

### Q5. Recruit `J1_Candidates` OAuth user permission (Eduardo + IT)

> **Why is the OAuth user (the one we authenticated via Self Client)
> blocked from Recruit `J1_Candidates`? Is this an intentional firewall,
> or should the Worker's service-account user be granted access?**

**Evidence:** `GET /recruit/v2/J1_Candidates` returns HTTP 403 with
`"permission denied - J1_Candidates (view)"`. The module exists
(confirmed via diagnostic probe — distinct from HTTP 400 for
nonexistent modules), but is profile-restricted from the user that
authenticated.

**Effect on wiring:** Cannot redirect the GHR portal Worker to write
to Recruit `J1_Candidates` until either:
- The OAuth user is granted permission on the module, or
- A different Zoho user (with permission) authenticates a new Self
  Client that the Worker uses.

### Q6. Purpose of Recruit `Applications` module (Eduardo)

> **What is the role of Recruit `Applications` (6,000+ records)?
> Is it the actual intake pipeline (where new portal applications
> should land), or strictly a downstream join table tracking
> candidate-applied-to-job pairings?**

**Evidence:** Section 2 deep-scan found 6,000+ records — more than
even Candidates (Seafarers). First three fields: `Origin`,
`Lock_Status`, `CTI_Office`. In standard Zoho Recruit, Applications
is a join table — but its size in this org suggests it may be more
central to the workflow.

**Effect on wiring:** If `Applications` is the canonical intake,
**both cruise and J-1 portals should write there**, not to
module-specific targets. Big architectural implication.

### Q7. Deleted Recruit CustomModule3 (IT)

> **What was Recruit `CustomModule3`? Was it related to any current
> architecture?**

**Evidence:** Custom modules are numbered Module1, Module2, Module4 —
with a gap at 3. Zoho doesn't reuse slot numbers, so a module was
created and deleted at some point.

**Effect:** Low-stakes, but useful context for IT cleanup.

### Q8. `Land_Based` module activation status (Eduardo)

> **Recruit `Land_Based` has 56 fields and a `Processing_Status`
> primary field — it's clearly provisioned for actual candidate
> work. Why does it have zero records?**

**Evidence:** Module is fully built out but completely empty. First
3 fields: `Processing_Status`, `Place_Of_Birth`, `Land_Based_Sources`.

**Effect on wiring:** If this is intended for land hospitality intake,
the GHR portal's "Land Hospitality" track may eventually route there
rather than to `J1_Candidates`.

---

## Decisions Needed (Once Answers Land)

Once Eduardo and IT have answered, these are the decisions Robert
will need to make:

| Decision | Inputs | Effect |
|---|---|---|
| **Cruise portal target** | Q3 IT answer + recruiter confirmation | Either retarget Worker at Recruit `Candidates` (recommended), or keep CRM if IT discovers a reason. |
| **GHR (J-1) portal target** | Q1 Eduardo answer | Either retarget Worker at Recruit `J1_Participants`, keep CRM `J1_Candidates`, or implement a two-write fan-out. |
| **CRM `Candidates` module fate** | Q3 IT answer | Archive, delete, or repurpose. |
| **CRM `J1_Candidates` module fate** (if vestigial) | Q1 + Q4 answers | Same archive/delete/repurpose call. |
| **`Land_Based` Recruit module activation** | Q2 Eduardo answer | Either activate as the GHR "Land Hospitality" target, or leave dormant. |
| **Test record cleanup** | After wiring decisions | Decide whether to keep or remove today's test records (`98ac7817-...` in CRM J1_Candidates; KV-cached cruise intakes that never wrote anywhere). |

---

## What's Frozen Until Decisions Land

Per Robert's instructions on 2026-05-12, the following are **not**
to be touched until the questions above are answered:

- Worker config (no `wrangler.toml` or `src/` changes)
- The CRM `J1_Candidates` test record from today
- The Recruit refresh token credentials (cached locally at
  `C:\Temp\recruit_refresh.txt` for future use when wiring is approved)
- The CRM Worker secrets in Cloudflare (`ZOHO_CRM_*` — still active and valid)

---

## Recommended Briefing Order

1. **Eduardo first** (Q1, Q2) — his answer to Q1 unlocks the GHR
   portal decision and shapes the Q4 IT request.
2. **IT second** (Q3, Q4) — frame Q4 in light of Eduardo's Q1 answer
   so IT knows what they're investigating.
3. **Robert decides** — using both inputs, lock the wiring direction.
4. **Next implementor session** — execute the agreed wiring under a
   feature branch with deploy preview before main.

---

*Source documents:*
- `docs/ZOHO-ARCHITECTURE-AUDIT-2026-05-12.md` — full evidence base
- `docs/AGENT-LOG.md` — chronological session log
