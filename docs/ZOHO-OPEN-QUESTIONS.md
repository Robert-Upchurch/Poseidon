# Zoho Open Questions — Stakeholder Briefing

**Date:** 2026-05-12 (initial) · 2026-05-13 (revised after IT PDF)
**Sources:**
- `docs/ZOHO-ARCHITECTURE-AUDIT-2026-05-12.md` (full audit, Sections 1–3)
- `docs/CTI_New_J1_Registration_Flow.pdf` (official IT deliverable, 2026-05-13)
**Status:** Q5 and Q6 answered by the IT PDF (CRM-first architecture
confirmed). Q7, Q8 still open. Q9-Q13 newly added from the PDF.

This is a one-page briefing aid for Robert's conversations with:

- **Eduardo Ferraz** — J-1 Operations VP. **Operational questions only**
  (workflow, day-to-day system usage, module purpose from the ops
  perspective).
- **Putu Astra** — Zoho Administrator + primary IT lead. **All admin /
  permissions / integration / architecture questions.**
- **Chendra** — IT support. Backup for Putu on technical investigations.

> **Routing rule:** If the question is about "how/where does ops work
> today," ask Eduardo. If the question is about "who has access /
> why is this locked / what does this module do at the schema level /
> who created what" — that's Putu Astra (with Chendra as support).

---

## For Eduardo Ferraz (J-1 Operations)

### Q1 (Eduardo). Canonical J-1 system

> **Which Zoho system does your J-1 ops team actually use day-to-day
> for the ~1,040 active participants — Recruit `J1_Participants` or
> CRM `J1_Candidates`?**

**Why we're asking:** The GHR Web Portal currently posts new J-1
intakes to **CRM `J1_Candidates`**. The Recruit `J1_Participants`
custom module has **1,040 records and 109 fields** of operational
lifecycle (4-stage investment, hosting company, sponsor interview,
visa, flights, housing). If recruiters work in Recruit, the portal is
writing to the wrong system.

**What we need from you (operational answer):**
- Where do recruiters check new applications and update statuses?
- Are CRM `J1_Candidates` and Recruit `J1_Participants` two stages of
  one pipeline (lead → processing), or duplicate systems?
- If we redirect the portal to Recruit, what should happen to existing
  CRM `J1_Candidates` records (migrate, delete, leave alone)?

### Q2 (Eduardo). Land_Based custom module purpose

> **Is the Recruit `Land_Based` module intended for hospitality land
> placements?**

**Why we're asking:** It exists in Recruit (UI label "Land Based"), is
fully provisioned (56 fields including `Processing_Status` primary),
but has zero records. Could be the eventual home for GHR portal
"Land Hospitality" track applicants.

**What we need from you (operational answer):**
- Confirm intent of the module.
- If unused, should it be activated / archived / repurposed?

### Q8 (Eduardo). Land_Based activation status

> **`Land_Based` has 56 fields including a `Processing_Status` primary
> field — clearly provisioned for actual candidate work. Why does it
> have zero records?**

(Folds into Q2. Eduardo decides whether to activate or leave dormant.)

### Q6a (Eduardo). Operational role of `Applications` module — **ANSWERED 2026-05-13**

> *Original question: is Recruit `Applications` where recruiters first
> see new portal applications, or strictly a downstream join table?*

**Answer (from IT PDF):** Strictly downstream. Under the CRM-first
architecture, recruiters first see new applications in CRM
`J1_Candidates` (UI: "J1 Participants"), filtered by the `New
Submission` custom view. Recruit Applications is the standard
candidate→job placement join, populated post-Stage-3.

(Q6b technical confirmation also answered above.)

---

## For Putu Astra (Zoho Administrator) — primary IT contact
*(Chendra: IT support backup on these)*

### Q3 (Putu Astra). CRM `Candidates` module — owner, origin, lockout

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

**What we need from Putu Astra:**
1. Who created the module and on what date?
2. Which profile(s) currently have access? (Likely none, given the
   Admin lockout.)
3. Are there any records in it? If so, how many and how old?
4. Does any workflow, integration, Flow rule, or dashboard reference
   it?
5. **Recommended action:** archive, delete, or repurpose?

This investigation has to happen inside Zoho CRM Setup with a user
that has full org access — the OAuth path is blocked.

### Q4 (Putu Astra). CRM `J1_Candidates` — record count + Flow inventory

> **Is the CRM `J1_Candidates` module actively used at the data layer,
> or is it a vestigial parallel to Recruit `J1_Participants`?**

**Why we're asking:** GHR portal writes succeed to this module (test
record `98ac7817-...` from today). But if Eduardo says the J-1 team
works in Recruit (Q1 above), then this CRM module is collecting data
nobody reads.

**What we need from Putu Astra:**
- Record count in CRM `J1_Candidates`
- Last modified date (any human activity in the last 90 days?)
- Any Flow rules, blueprints, or assignment rules pointing at it?
- Whether records overlap with Recruit `J1_Participants` (by email
  match) — could indicate prior migration attempts
- Archive/delete/repurpose recommendation if vestigial.

### Q5 (Putu Astra). Recruit `J1_Candidates` OAuth user permission — **ANSWERED 2026-05-13**

> *Original question: why is the OAuth user blocked from Recruit
> `J1_Candidates`?*

**Answer (from IT PDF):** Under the new CRM-first architecture
(`docs/CTI_New_J1_Registration_Flow.pdf`), CRM is the canonical J-1
intake. Recruit only receives records *after* host-company approval at
the end of Stage 2 ("Move to Zoho Recruit" = Stage 3 onward). The
Recruit `J1_Candidates` module is no longer the active intake target
— its `NO_PERMISSION` lockdown is consistent with deprecation /
historical archival. **No Worker grant needed.** If historical Recruit
`J1_Candidates` records need to be migrated into the new CRM flow,
that's a one-time data migration — out of scope for the Worker.

### Q6b (Putu Astra). Technical schema of Recruit `Applications` — **ANSWERED 2026-05-13**

> *Original question: at the schema level, is Recruit `Applications`
> the canonical intake target?*

**Answer (from IT PDF):** No. Under the CRM-first architecture,
Recruit handles only Stage 3+ (visa through placement). The
Applications module's 6,000+ records correspond to the standard
Recruit candidate → job join table used for placement tracking, not
portal intake. No Worker writes to Applications are needed; intake
stays in CRM `J1_Candidates`.

### Q7 (Putu Astra). Deleted Recruit `CustomModule3`

> **What was Recruit `CustomModule3`? Was it related to any current
> architecture?**

**Evidence:** Custom modules are numbered Module1, Module2, Module4 —
with a gap at 3. Zoho doesn't reuse slot numbers, so a module was
created and deleted at some point.

**What we need from Putu Astra:**
- Historical record of the deleted module (purpose, owner, deletion
  date) — useful context for the cleanup effort.
- Low-stakes; can be answered last.

---

## New Questions From the 2026-05-13 IT PDF

### Q9 (Putu Astra). CRM module naming — "J1 Participants" (UI) vs `J1_Candidates` (API)

> **Is the CRM module shown in the PDF as "J1 Participants" the same
> module as API name `J1_Candidates` (the one the Worker writes to),
> or are these two different modules?**

**Evidence:**
- IT PDF screenshot (page 4, "Zoho CRM Panel") shows a CTI Teamspace
  sidebar entry labeled **"J1 Participants"** with columns
  `J1 Program Source`, `J1 Application Status`, `First Name`, `Last
  Name`. Records visible include statuses `New Submission` and `Sales
  Call`.
- Our Worker writes to API name `J1_Candidates` (commit `27c479e`,
  test record `ClaudeTest2 PostNameFix` succeeded).
- CRM metadata for `J1_Candidates` returns plural label `J1 Candidates`
  (singular `J1 Candidate`) — NOT `J1 Participants`.
- A direct probe `getModuleByApiName J1_Participants` returns
  `{"data":[]}` — no separate CRM J1_Participants module exists in our
  OAuth scope.

**Most likely answer:** Same module; the "J1 Participants" label is a
Teamspace rename or layout-level alias applied after the metadata
returned to our OAuth client. Need Putu Astra to confirm so we can rule
out a second module the OAuth user simply cannot see.

**What we need from Putu Astra:**
- Confirm that CRM `J1_Candidates` and the PDF's "J1 Participants" are
  the same module.
- If not, what is the API name of the PDF's "J1 Participants" module,
  and should the Worker repoint to it?
- If they are the same, can the API metadata labels be aligned with
  the UI label to avoid future confusion?

### Q10 (Putu Astra / Eduardo). Cruise CRM → Recruit progression — same or different?

> **Does the same CRM → Recruit progression apply to the cruise
> (seafarer) portal, or is cruise structured differently?**

**Why we're asking:** The 2026-05-13 PDF documents the J-1 flow only.
Section 2 of the audit found that cruise records live directly in the
Recruit `Candidates` module (UI: "Seafarers", 5,000+ records) from
intake forward — there does not appear to be a CRM-first intake stage
for cruise.

**What we need:**
- Eduardo / Putu confirm whether cruise intentionally bypasses CRM
  (cruise-direct-to-Recruit), or whether a CRM-first cruise flow is
  on the IT roadmap but not yet documented.
- If cruise-direct-to-Recruit is the intended architecture, the
  current Worker behavior (cruise portal → CRM `Candidates`, which
  fails with `NO_PERMISSION`) is also misaligned and needs a
  separate cruise-flow PDF / spec.
- If cruise should eventually mirror the J-1 CRM-first flow, that's a
  larger architectural change to plan for.

### Q11 (Putu Astra). Sales Call branch — Worker scope or CRM-internal only?

> **The PDF flow includes a "Sales Call" branch when a participant is
> approved at consultation but has not paid Stage 1. Does this branch
> require any Worker action (e.g., notification webhook, status push)
> or is it purely a CRM-internal blueprint / workflow transition?**

**Why we're asking:** Worker behavior must match the canonical flow.
If Sales Call requires Worker participation (e.g., portal-side payment
processing, external billing system handoff), we need to scope that
work. If it's a CRM-internal transition triggered by recruiter action
on the record, the Worker has no scope and we move on.

**What we need from Putu Astra:**
- Worker scope: yes / no / what.
- If yes, what triggers Sales Call from the Worker side (timer? portal
  re-engagement? external billing webhook?) and what fields/values does
  Worker need to write to CRM?

### Q12 (Eduardo / Putu Astra). Recruit `Land_Based` under new architecture

> **Now that Recruit only handles Stage 3+ (visa through placement),
> what is the intended purpose of Recruit `Land_Based` (56 fields,
> 0 records, fully provisioned)?**

(Reframe of Q8 with PDF context. Q8 also stays open and is folded into
this one.)

**Why we're asking:** Under the CRM-first architecture, Land_Based
can't be an intake module (intake is CRM). It also has zero records.
Possible roles:
- Placement-stage destination for the "Land Hospitality" track (GHR
  portal currently feeds CRM `J1_Candidates`, but Stage 3+ in Recruit
  may need a land-specific module separate from the cruise `Candidates`
  module).
- Provisioned-but-abandoned remnant from an earlier architectural plan.
- Future-state module pending an as-yet-undocumented flow.

### Q13 (Putu Astra). Recruit `CustomModule3` deletion history

> **What was the deleted Recruit `CustomModule3`, and is anything from
> it relevant to the new CRM-first architecture?**

(Reframe of Q7 with PDF context. Q7 also stays open and is folded into
this one.)

**Why we're asking:** Low-stakes historical context — but if it was a
prior J-1 or cruise intake experiment, knowing its purpose may explain
why some of the now-locked Recruit modules (`J1_Candidates`,
`Land_Based`) are in the state they're in.

---

## Decisions Needed (Once Answers Land)

Once Eduardo and Putu Astra have answered, these are the decisions
Robert will need to make:

| Decision | Inputs | Effect |
|---|---|---|
| **Cruise portal target** | Q3 (Putu Astra) + recruiter confirmation | Either retarget Worker at Recruit `Candidates` (recommended), or keep CRM if Putu discovers a reason. |
| **GHR (J-1) portal target** | ~~Q1, Q5~~ — **RESOLVED by 2026-05-13 IT PDF: keep CRM `J1_Candidates`. CRM is the intentional new intake. No Worker change.** Pending only Q9 confirmation (UI label = API name?). |
| **CRM `Candidates` module fate** | Q3 (Putu Astra) | Archive, delete, or repurpose. |
| **CRM `J1_Candidates` module fate** (if vestigial) | Q1 (Eduardo) + Q4 (Putu Astra) | Same archive/delete/repurpose call. |
| **`Land_Based` Recruit module activation** | Q2 / Q8 / Q12 | Under CRM-first arch, Land_Based can't be intake. Decide: post-Stage-3 land-hospitality destination, abandon, or repurpose. |
| **`Applications` module wiring role** | ~~Q6a, Q6b~~ — **RESOLVED by IT PDF: downstream join, not intake. Leave alone.** |
| **Worker OAuth user identity** | Q5 (Putu Astra) | Decide whether to use Robert's account, a service account, or have IT issue a dedicated OAuth user with module access. |
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

## Recommended Briefing Order (revised 2026-05-13)

The IT PDF has resolved the central GHR-J-1 wiring question (CRM is
canonical intake — no Worker change). The remaining briefing is
narrower:

1. **Putu Astra** (Q9, Q11, Q13) — module-name alignment (J1
   Participants vs J1_Candidates), Sales Call branch scope for the
   Worker, CustomModule3 history.
2. **Putu Astra + Eduardo together** (Q10, Q12) — cruise CRM-first
   roadmap (or confirmation that cruise stays direct-to-Recruit), and
   the future role of `Land_Based`.
3. **Eduardo solo** (Q1 cruise-side, Q2 Land_Based) — only if needed
   after the joint conversation.
4. **Putu Astra solo** (Q3, Q4, Q7) — CRM `Candidates` lockout
   investigation, CRM `J1_Candidates` record count + Flow inventory,
   deleted CustomModule3.
5. **Robert decides** — most decisions now narrow to confirmations and
   cleanup, not wiring direction.
6. **Next implementor session** — only if cruise wiring or Sales Call
   scope changes from the answers above.

---

*Source documents:*
- `docs/ZOHO-ARCHITECTURE-AUDIT-2026-05-12.md` — full evidence base
- `docs/AGENT-LOG.md` — chronological session log
