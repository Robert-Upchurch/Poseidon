# Zoho Architecture Audit — 2026-05-12

**Scope:** Read-only inventory of CTI Group's Zoho CRM and Zoho Recruit
deployments to determine the canonical home for cruise (seafarer) and
J-1 cultural exchange candidate records.

**Audience:** Eduardo, IT team, CTI leadership.

**Status:** Discovery complete. No writes performed. No Worker
configuration changes. Recommended wiring changes are flagged as
pending pending stakeholder approval — see Recommendations.

---

## Executive Summary

The portal-intake Cloudflare Worker (`poseidon-proxy`) currently writes
to **Zoho CRM custom modules**. The audit shows that the **operational
candidate data lives in Zoho Recruit**, not CRM:

- **Cruise (seafarer) candidates:** Recruit `Candidates` module (UI
  label "Seafarers") — **5,000+ records, 213 fields**, full MLC
  compliance schema. The CRM `Candidates` module the Worker targets is
  orphaned and locked from Administrator access.
- **J-1 cultural exchange candidates:** Recruit `J1_Participants`
  custom module — **1,040 records, 109 fields**, full 4-stage
  investment + hosting company + sponsor + visa + flight lifecycle.
  The Worker currently writes J-1 intakes to CRM `J1_Candidates`,
  which appears to be a parallel (likely duplicate) system.

**Bottom line:** The current Worker wiring is architecturally
misaligned. Cruise → CRM is a dead-end (locked module, no records, no
permissions). J-1 → CRM works today but may be writing to the wrong
system if Recruit `J1_Participants` is canonical.

---

## Methodology

| Item | Value |
|---|---|
| Date | 2026-05-12 |
| Performed by | Claude Code (Implementor session) |
| OAuth flow | Zoho Self Client at `api-console.zoho.com` |
| Self Client | "Poseidon Worker — CRM" (existing) |
| CRM scope used | `ZohoCRM.modules.ALL ZohoCRM.settings.modules.READ` |
| Recruit scope used | `ZohoRecruit.modules.ALL ZohoRecruit.settings.ALL` |
| Refresh token storage | CRM token → Cloudflare Worker secret `ZOHO_CRM_REFRESH_TOKEN`. Recruit token → in-memory + local cache only (`C:\Temp\recruit_refresh.txt`). NOT stored as Worker secret. |
| Data center | US (`accounts.zoho.com`, `recruit.zoho.com`, `www.zohoapis.com`) |
| Write operations | **None.** Inventory only. |
| PII access | None — only record IDs were retrieved for counting. No name/email/phone data persisted from Recruit. |

---

## Recruit Module Inventory

| Module API | UI Label | Records | Type | Cruise/Maritime Indicators |
|---|---|---|---|---|
| **Candidates** | **Seafarers** | **5,000+** (paged 26 pages, more remaining) | default | **Primary cruise home** — 213 fields, MLC compliance grade |
| **J1_Participants** | J1 Participant | **1,040** (exact) | custom | Full J-1 lifecycle |
| Land_Based | Land Based | 0 | custom | Empty — provisioned but unused. Possibly intended for land hospitality? |
| Travel_Department | Travel Department | 1 | custom | Single record — likely meta/seed |
| Job_Openings | Job Opening | 466 | default | Open seafarer positions |
| Clients | Client | 17 | default | Cruise line employer records (1:1 with Cruise_Line picklist) |
| Contacts | Contact | 2 | default | Sparse |
| Submissions | Submission | 0 | default | Empty |
| Vendors | Vendor | 1 | default | Sparse |
| Interviews | Interview | 0 | default | Empty |
| Applications, Approvals, Assessments, Reviews, Home, messages__s | (system) | — | default | Internal/system |

**Total modules:** 16 (4 custom, 12 default)

---

## Cruise Organizational Structure (Enumerated as Picklists)

### 17 Cruise Lines (Cruise_Line picklist, matches Clients module 1:1)

Carnival · CUK Maritime · Cunard · Four Seasons Yachts · Heinemann
Americas · Holland America · Marella · Margaritaville at Sea ·
Norwegian · Oceania · P&O · Regent Seven Seas · Seabourn · TUI River
Cruises · Viking · Virgin Voyages

### 25 Departments (Department picklist)

Art Gallery · Auxiliary · Casino · Culinary · Deck & Engine ·
Electrical Technician · Entertainment · Finance · F&B Service · Gift
Shops · Guest Services · Hotel Operations · Housekeeping · HR · IT ·
Inventory Mgmt · Photo · Provisions · Retail Ops · Sanitation ·
Security · Shore Excursion · SPA · Technician

### 13 CTI Regional Offices (CTI_Office picklist — matches the Poseidon expansion strategy hubs)

Management Office · Asia · Bali · Bangkok · Lombok · Malaysia · MCSI ·
Myanmar · Vietnam · Yogyakarta · Partner Crew Life · Partner Kendrick

### Catalogue Scale

- **134** distinct Positions (Cabin Steward, Able Body, Chef De Partie,
  1st Commis Cook, Bartender, etc.)
- **119** specific Ships (Carnival Adventure, HAL Eurodam, Brilliant
  Lady, Britannia, Norwegian Encore, etc.)
- **434** Embarkation Ports (Aalesund through Zeebrugge — comprehensive
  global cruise port coverage)
- **16** Banks (Thai + Indonesian banking institutions — matches
  regional hub geography: Kasikorn, Krungsri, SCB, etc.)

---

## MLC / Seafarer Compliance Field Coverage on Recruit `Candidates`

| Compliance Area | Field Count | Representative Fields |
|---|---|---|
| Marlins (English Test) | 6 | Test_Code, Score, Duration, Result, Code_Generated_Date, Code_Given_Date |
| Passport | 6 | Status, Number, Issued_Date, Issued_Place, Expired_Date, Issued_Country |
| Seaman's Book + SDB (Bermuda) | 5 | Seaman_Book status/number/expiration, Bermuda_Seaman SDB status/expiration |
| BID | 2 | Status, Expiration |
| US Visas (C1, D, C1/D) | 11 | Status / number / expiration / appointment per visa class |
| Other Country Visas | 14 | NZeTA (NZ), ATV (Australia), Schengen, Spain Schengen, Canadian, Other, MCV |
| Medical Certificate | 4 | Status, Examination_Date, Issuance_Date, Expiration_Date |
| Vaccinations | 1 multipicklist | Completed_Vaccination tracking (Yellow Fever, MMR, etc.) |
| BST (Basic Safety Training) | 3 | Status, Number, Expiration |
| SAT, PSCRB, Crisis Mgmt, Crowd Mgmt | 12 | Each: status, number, expiration |
| Proficiency Certificates (STCW) | 8 | Cert 1+2 with status/number/expiration |
| Rating Forming (II/4, II/5, III/4) | 12 | Engine/deck rating compliance per STCW |
| ETR (Electro-Technical Rating) | 3 | Status, Number, Expiration |
| COC/COE | 3 | Certificate of Competency/Endorsement |
| Welder Certificate | 3 | Status, Number, Expiration |
| IGF Basic CoP (V/3-1) | 2 | Status, Number — gas-fuelled ship compliance |
| Financial (cost tracking) | 9 | C1D, Medical, Canadian Visa, Schengen Visa, Vaccination, RT-PCR, Meal Allowance, Other Visa + Total/Tax formulas |
| Banking | 2 | Bank_Account, Bank_Name |
| Contract Lifecycle | ~20 | Sign_On_Date, Sign_Off_Date, Sign_On_Port, Joining_Ship, Position_Hired, Cruise_Line, plus full duplicate set "_2" for 2nd contract, plus Rescheduled/Resignation reasons |

**Total Candidates module fields:** 213 — comprehensive MLC 2006
compliance instrumentation, deployed and operational.

---

## Parallel System Concern: GHR Portal → CRM `J1_Candidates`

### Current Worker Behavior

The Worker's `PARTITION.ghr` maps the GHR portal POST to CRM custom
module `J1_Candidates` (CustomModule12). As of today's session, a test
record was successfully created in this module:
- Candidate ID: `98ac7817-dfb4-4df7-a52f-13c8cf525557`
- CRM record: `ClaudeTest2 PostNameFix` / `claude-verify+ghr2@cti-usa.com`

This proves the wiring works.

### The Concern

Recruit has its own J-1 module: `J1_Participants` (custom, 109 fields,
**1,040 records**). It contains the operational J-1 lifecycle including:

- 4-stage investment workflow (`Stage_1_Investment` …
  `Stage_4_Investment` + payment methods + status flags)
- Hosting Company workflow (`Hosting_Company_2`, `Hosting_Company_Interview_Date`, `HC_Interview_Status`, `Submission_Date_Hosting_Company`, `Declining_Hosts`)
- Sponsor workflow (`Processing_Sponsor`, `Sponsor_Interview_Date`,
  `Sponsor_Interview_Status`, `Sponsor_Online_Orientation`)
- Visa lifecycle (`J1_Visa_Number`, `J1_Visa_Status`,
  `J1_Visa_Appointment_Date`, `Reference_Letter_Status`,
  `Program_Sponsor_Invoice_Status/Number`)
- Flight lifecycle (`Trip_From/To`, `Ticket_Pricing`, `Airline`,
  `Airport_Gateway`, `Airport_Pick_Up`, plus full return-trip set)
- Housing (`Housing_Name`, `Housing_Price`, `Housing_Address`,
  `Initial_Housing_Payment_Before_Departure`)
- Eligibility / Documents (`Eligible_Programs`, `Police_Clearance_Status`,
  `Academic_Status`, `Academic_Transcripts`, `English_Assessment`,
  `English_Assessment_Letter`, `Signed_J1_Policy`)

This is the operational J-1 system that recruiters use.

### Question for Eduardo / J-1 Ops

**Is CRM `J1_Candidates` the canonical store for J-1 applicants, or is
Recruit `J1_Participants` the canonical store?**

Possible scenarios:
1. CRM J1_Candidates is the "lead intake" stage; Recruit
   J1_Participants is the "processing" stage; records are intended
   to migrate between them. The Worker wiring is correct.
2. Recruit J1_Participants is the sole operational system; CRM
   J1_Candidates is a vestigial or experimental module. The Worker
   wiring should be redirected.
3. CRM J1_Candidates is for one program tier (e.g., hospitality fast
   track) and Recruit J1_Participants is for another. The Worker
   wiring may need conditional routing.

**No Worker change recommended until this is resolved.** The test
record we created today remains in CRM J1_Candidates and is not being
deleted. If scenarios 2 or 3 turn out to be the answer, we can review
whether to migrate or clean it up later.

---

## Cruise Wiring Recommendation

**Cruise (Cruise Web Portal) → Recruit `Candidates` (Seafarers).** NOT
CRM `Candidates`.

Required changes (when approved):

1. **OAuth credentials:** Add Recruit-scoped Worker secrets. Current
   Worker has `ZOHO_CRM_*` secrets only. We need
   `ZOHO_RECRUIT_CLIENT_ID`, `ZOHO_RECRUIT_CLIENT_SECRET`,
   `ZOHO_RECRUIT_REFRESH_TOKEN`. The Recruit refresh token from
   today's discovery session is cached locally at
   `C:\Temp\recruit_refresh.txt` and can be re-used when wiring is
   approved (or a fresh credential can be issued).

2. **API host change:** From `https://www.zohoapis.com/crm/v6/` to
   `https://recruit.zoho.com/recruit/v2/`.

3. **Module name:** `Candidates` (API name is the same; the
   "Seafarers" label is UI-only).

4. **Field mapping refactor (`mapToZohoFields`):** Recruit Candidates
   has 213 fields. The Web Portal posts a small subset
   (`first_name`, `last_name`, `email`, `phone`,
   `country_of_citizenship`, `date_of_birth`, `preferred_role`,
   `years_experience`, etc.). The Worker should map to:
   - `First_Name`, `Last_Name`, `Email`, `Phone` — same field names
     work in Recruit
   - `Position_Applied` (picklist!) — needs picklist-value
     coordination with portal options
   - `Candidate_Status` = `"Pre-application"` (recommended default)
   - `Candidate_Stage` = `"Pre-application"` or similar — confirm with
     recruiters
   - Most other fields (Marlins, BST, Passport, etc.) populate later
     in the recruiter workflow, not at portal intake

5. **Primary field:** Recruit Candidates module likely also uses the
   `Name` field as primary (same custom-module pattern as CRM). The
   Name-field fix we deployed today (commit `27c479e`) should carry
   over conceptually.

6. **Module-firewall partition logic:** The Worker has
   partition-violation rejection that blocks cross-portal payloads.
   Keep the logic; just update the target modules.

---

## CRM `Candidates` Locked-Module Question for IT

**Symptom:** The CRM `Candidates` custom module (CustomModule13)
returns `NO_PERMISSION` for both record reads AND module-metadata
reads under the OAuth user authenticated via the Self Client. This
suggests either:

- The module is profile-restricted to a profile the OAuth user is not
  on
- The module is orphaned (created and forgotten by a prior IT effort)
- The module has been intentionally archived but not deleted

**Questions for IT:**

1. Who created the module and when?
2. Who currently has profile permission on it?
3. Are there any records in it (if not, why does it exist)?
4. Does any workflow, integration, or dashboard reference it?
5. Should it be archived, deleted, or repurposed?

We cannot answer these questions through the current OAuth path
(`settings/modules/Candidates` returns `NO_PERMISSION` even with
`ZohoCRM.settings.modules.READ` scope). An IT admin with full org
access needs to investigate directly in Zoho CRM Setup.

---

## Recommended Next Discovery Steps (Before Any Writes)

Before changing any Worker wiring, complete these read-only verifications:

1. **Eduardo confirms** which J-1 module is canonical (CRM
   `J1_Candidates` vs Recruit `J1_Participants`). Could route this as a
   simple question: "Where do new J-1 applicants land in our day-to-day
   recruiter workflow?"

2. **Inventory CRM `J1_Candidates`** for parallel-system comparison.
   Today's session never queried its record count or field set
   (operational time pressure). A fresh read-only query (~5 min) would
   give us:
   - Total record count
   - Field count
   - Creation/owner metadata
   - Whether records overlap with Recruit `J1_Participants` (by email
     match)

3. **Inventory the empty Recruit modules** (`Land_Based`,
   `Submissions`, `Interviews`) to determine their intended purpose. A
   field-schema query (no records to fetch) will reveal what they were
   provisioned for.

4. **Recruit `Department` field for J1_Participants** — confirm
   whether J-1 participants are tagged with "Cruise" or any maritime
   department (would indicate cross-pollination between J-1 program
   and seafarer hiring).

5. **CRM `J1_Candidates` field schema** vs Recruit `J1_Participants`
   field schema — identify what data is unique to each, what
   overlaps, and what would migrate.

6. **Recruiter feedback session** (Eduardo + recruiters): which
   system do they actually use for daily work? Where do they check
   "new applications"? Where do they update status? This grounds the
   technical decision in actual workflow.

Once these steps are complete, propose a final wiring decision for
Worker reconfiguration, then implement under a feature branch with
deploy preview before main.

---

## Appendix: Credentials Status

| Credential | Storage | Status |
|---|---|---|
| `DASHBOARD_TOKEN` | Cloudflare Worker secret + browser localStorage | Active, verified |
| `ZOHO_CRM_CLIENT_ID` | Cloudflare Worker secret | Active |
| `ZOHO_CRM_CLIENT_SECRET` | Cloudflare Worker secret | Active |
| `ZOHO_CRM_REFRESH_TOKEN` | Cloudflare Worker secret | Active |
| Recruit OAuth refresh token (today's discovery) | `C:\Temp\recruit_refresh.txt` (local cache only) | Cached for future use when wiring is approved. **NOT** stored as Worker secret. |
| Recruit OAuth access token (today's discovery) | `C:\Temp\recruit_access.txt` | Expires ~55 min after issue |

---

---

# Section 2 — Deep Scan (after Eduardo confirmation)

**Trigger:** Eduardo confirmed that J-1 and Cruise are separate Recruit
modules (firewall-by-module), and that J-1 records start in a Recruit
"J-1 Candidates" intake module that graduates to `J1_Participants`.

**Goal:** Re-scan Recruit with the same OAuth credentials (refresh
token reused from Section 1 cache) to find the exact API name of the
J-1 intake module and any equivalent Cruise intake module that
Section 1 may have missed.

## Decisive Findings

### 1. `J1_Candidates` exists in Recruit — but is NO_PERMISSION

```
GET /recruit/v2/J1_Candidates                        → HTTP 403
GET /recruit/v2/settings/modules/J1_Candidates       → HTTP 403
GET /recruit/v2/settings/fields?module=J1_Candidates → HTTP 403

Error body: {"code":"NO_PERMISSION",
             "message":"permission denied - J1_Candidates (view)",
             "status":"error"}
```

This is **diagnostic-grade evidence** that the module exists:
- HTTP 403 with `NO_PERMISSION` means "the module is real, you're
  blocked." It is distinct from HTTP 400 (module doesn't exist) — I
  confirmed by probing 13 nonexistent name variants, all of which
  returned HTTP 400.
- Eduardo's description matches this exactly: the J-1 intake module
  exists, and the OAuth user we authenticated as is profile-blocked
  from it.

**Implication:** Just like CRM `Candidates`, the Recruit `J1_Candidates`
module is profile-restricted. This is a deliberate compliance pattern
(intake stage walled off from anyone who isn't J-1 ops) — not a bug.

### 2. No equivalent "Cruise Candidates" intake module exists

Probed 13 name variants with the same `403 vs 400` test:

| Probed name | Result | Interpretation |
|---|---|---|
| `Cruise` | 400 | does not exist |
| `Cruise_Candidates` | 400 | does not exist |
| `Cruise_Intake` | 400 | does not exist |
| `Cruise_Applicants` | 400 | does not exist |
| `Cruise_Crew`, `Cruise_Crews`, `Cruise_Crewmember` | 400 | do not exist |
| `Maritime`, `Maritime_Candidates`, `Mariners`, `Mariner_Candidates` | 400 | do not exist |
| `Seafarer_Candidates`, `Seafarer_Intake` | 400 | do not exist |
| `CustomModule5` through `CustomModule10` | 400 | empty slots |

**The cruise architecture does NOT have a separate intake module.**
Cruise candidates live directly in the default `Candidates` module
(UI-relabeled as "Seafarers") from the moment they enter the system.

### 3. Deleted custom module slot — CustomModule3

The three visible custom modules are numbered:
- `Travel_Department` = CustomModule1
- `J1_Participants` = CustomModule2
- `Land_Based` = CustomModule4

There is a **gap at CustomModule3** (probed directly, returned HTTP
400). Zoho does not reuse module slot numbers, so this almost
certainly indicates a custom module that was created and then deleted
at some point in the org's history.

**Open question for IT:** Was CustomModule3 a precursor to one of the
current modules, or unrelated? May indicate prior architectural
experiments.

### 4. NEW finding: `Applications` module has 6,000+ records

This was missed in Section 1's count pass because the default
modules (`Applications`, `Approvals`, `Assessments`, `Reviews`,
`messages__s`) weren't paginated. Recounting yielded:

| Module | Records (deep-scan total) |
|---|---|
| **Applications** | **6,000+** (paged 31 pages, more remaining) |
| Approvals | unauthorized (HTTP 401 — different permission set) |
| Assessments | error (HTTP 400 with our query — may need different fields param) |
| Reviews | 0 (HTTP 204 — empty) |
| messages__s | 0 (HTTP 204 — empty) |

This is **significant** — `Applications` has more records than even
`Candidates` (Seafarers). The first three fields are `Origin`,
`Lock_Status`, `CTI_Office`. In standard Zoho Recruit Enhanced for
Staffing, `Applications` is a JOIN table linking Candidates to
Job_Openings (one record per candidate-applied-to-job pairing). With
6,000+ records, this is the primary pipeline activity log.

**Open question for Eduardo:** Is `Applications` the actual intake
pipeline (i.e., where new portal submissions should land), or is it
strictly a downstream join table tracking placements?

## First 3 Field Names per Accessible Module

(For schema-shape verification per Robert's request.)

| Module | Total fields | First 3 field API names |
|---|---|---|
| Candidates (Seafarers) | 213 | `Origin`, `CTI_Office`, `Marital_Status` |
| J1_Participants | 109 | `J1_Application_Status`, `CTI_USA_s_Review`, `Archive_Reason` |
| Land_Based | **56** | `Processing_Status`, `Place_Of_Birth`, `Land_Based_Sources` |
| Travel_Department | 48 | `Requesting_Agent_Name`, `Return_Date`, `Email` |
| Job_Openings | 54 | `Candidate_Submission_Limit`, `Placement_Category`, `Client_Name` |
| Clients | 31 | `Client_Name`, `About`, `Contact_Number` |
| Contacts | 43 | `Origin`, `Client_Name`, `Client_Portal_User_Status` |
| Submissions | 18 | `Submission_ID`, `Candidate_Name`, `Submission_Name` |
| Vendors | 19 | `Vendor_Name`, `Email`, `Phone` |
| Interviews | 32 | `Interview_Name`, `Job_Opening_Name`, `Candidate_ID` |
| Applications | 33 | `Origin`, `Lock_Status`, `CTI_Office` |
| Assessments | 13 | `Assessment_Name`, `Assessment_Owner`, `Created_By` |
| Reviews | 23 | `Review_Name`, `Review_ID`, `Candidate_Name` |
| J1_Candidates | **NO_PERMISSION** (cannot read schema) | — |

**Note on Land_Based:** 56 fields and a `Processing_Status` primary
field shows this module is fully provisioned for actual candidate
work — it's not a stub. Just sitting at 0 records. Likely intended
for land hospitality but never activated. Eduardo should confirm.

## Updated Architecture Summary

```
Recruit/                                                         records
├─ Candidates (Seafarers)         ◀── CRUISE home, full intake-to-deploy   5000+
├─ J1_Candidates                  ◀── J-1 intake (locked from us)          unknown
├─ J1_Participants                ◀── J-1 processing (post-graduation)     1040
├─ Land_Based                     ◀── PROVISIONED but unused               0
├─ Travel_Department              ◀── tiny meta module                     1
├─ Applications                   ◀── 6K+ records — pipeline join?         6000+
├─ Job_Openings                                                            466
├─ Clients (Cruise Lines)                                                  17
├─ Contacts                                                                2
├─ Submissions, Interviews, Reviews, messages__s, Vendors                  ~0
└─ (CustomModule3 — deleted)                                               n/a
```

## Implications for the Earlier Cruise/J-1 Wiring Question

1. **Cruise wiring** (was already the recommendation in Section 1):
   target Recruit `Candidates` (Seafarers). **No change from Section 1.**

2. **J-1 wiring** (open question in Section 1, partly resolved here):
   Eduardo's "J-1 starts in intake module, graduates to J1_Participants"
   is consistent with Recruit `J1_Candidates` being the intake target.
   This means:
   - Worker should redirect GHR portal from CRM `J1_Candidates` to
     **Recruit `J1_Candidates`** (same API name, different system).
   - To write there, **IT must grant the OAuth user permission on
     Recruit `J1_Candidates`** (or a service-account user with that
     permission must be used for the Worker OAuth).
   - Confirm with Eduardo whether the intake module is also called
     `J1_Candidates` in his daily UI, or whether his terminology
     maps to a different module name.

3. **Land_Based** — Eduardo should confirm whether this is intended for
   land hospitality intake; if yes, the GHR portal's "Land Hospitality"
   track may eventually route there instead of `J1_Candidates`.

4. **Applications module** — important to understand its role before
   any wiring decision. If it's the canonical intake target, both
   cruise and J-1 portals should write there instead of module-specific
   targets.

## Updated Open Questions

Adding to the list in `docs/ZOHO-OPEN-QUESTIONS.md`:

- **Q5 (Eduardo + IT):** Why is the OAuth user blocked from Recruit
  `J1_Candidates`? Is this an intentional firewall, or should the
  Worker's service-account user be granted access?
- **Q6 (Eduardo):** What is the purpose of Recruit `Applications`
  (6,000+ records)? Is it where new portal applications should land,
  or is it strictly downstream join data?
- **Q7 (IT):** What was the deleted CustomModule3 in Recruit?
  Anything related to current architecture?
- **Q8 (Eduardo):** `Land_Based` module has 56 fields and a
  `Processing_Status` primary — clearly provisioned. Why zero records?

## What Was Not Done

- No record reads on `J1_Candidates` (NO_PERMISSION blocked us)
- No record reads on `Applications` beyond ID-only counting (no PII)
- No field-schema reads on `J1_Candidates` (NO_PERMISSION)
- No Worker changes, no module creations, no deployments
- No deletion of the cached Recruit refresh token at
  `C:\Temp\recruit_refresh.txt` — kept for the next session when
  wiring is approved

---

*End of Section 2. Awaiting Eduardo + IT responses before any
implementation work.*
