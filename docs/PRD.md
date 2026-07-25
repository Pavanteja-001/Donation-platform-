# Product Requirements Document — DonationPlatform

**Status:** Living document · **Version:** 0.9 · **Region:** India (Andhra Pradesh first)

> Living document. Sections 1–9 and Appendix A (design system) are drafted. Sections 10+ are
> mapped in the ToC and written just before their build milestone. Update the version and
> changelog whenever a section changes.

---

## Table of Contents

| # | Section | Status |
|---|---------|--------|
| 1 | Vision & Mission | ✅ drafted |
| 2 | Problem Statement | ✅ drafted |
| 3 | Goals & Success Metrics | ✅ drafted |
| 4 | Users & Personas | ✅ drafted |
| 5 | Scope & Build Order | ✅ drafted |
| 6 | Core "Need" Engine (shared lifecycle) | ✅ drafted |
| 7 | Money Need flow | ✅ drafted |
| 8 | Blood module (eligibility + geo-matching) | ✅ drafted |
| 9 | Kit flow (grocery / education) | ✅ drafted |
| 10 | Meal-slot booking (orphanages) | ⬜ to write |
| 11 | Goods / unused-items flow | ⬜ to write |
| 12 | Community Q&A forum | ⬜ to write |
| 13 | Volunteering (scribes, career mentoring) | ⬜ to write |
| 14 | Trust tiers & digital certificates | ⬜ to write |
| 15 | Admin console | ⬜ to write |
| 16 | Institution web panel | ⬜ to write |
| 17 | Notifications | ⬜ to write |
| 18 | Data model / schema | ⬜ to write |
| 19 | API contracts | ⬜ to write |
| 20 | Non-functional: security, privacy, performance | ⬜ to write |
| 21 | Analytics & metrics | ⬜ to write |
| 22 | Rollout plan | ⬜ to write |
| 23 | Risks | ⬜ to write |
| 24 | Open questions | ⬜ to write |
| A | Appendix — Design System (shared theme, all surfaces) | ✅ drafted |

---

## 1. Vision & Mission

**Vision.** A single trusted platform where anyone in India can give — money, blood, time, or
goods — to a verified need near them, and see exactly where their help went.

**Mission.** Remove the two things that stop everyday giving: *not knowing what's genuinely
needed*, and *not trusting that help reaches the right person*. Every need is verified before it
goes live, and every fulfillment is confirmed by the person who received it.

---

## 2. Problem Statement

People who want to help often don't, because:

- They don't know *what* is needed right now, or *where*, or *how urgent* it is.
- They can't tell a genuine need from a fraudulent one — one fake medical appeal poisons trust
  for everyone.
- Blood requests are time-critical and local, but reach the wrong people (or nobody) too slowly.
- Giving is fragmented across many channels; there's no single place that also *shows the outcome*.

Beneficiaries and institutions (NGOs, hospitals, blood banks, orphanages) face the mirror
problem: no single, credible channel to broadcast a verified need and receive help transparently.

**The platform's real product is trust.** The app is the wrapper around it.

---

## 3. Goals & Success Metrics

**Product goals**
- G1 — Make posting a verified need simple for individuals and institutions.
- G2 — Make discovering and fulfilling a relevant, nearby need effortless for donors.
- G3 — Make every donation traceable end-to-end (posted → verified → funded → confirmed).
- G4 — Match blood requests to eligible, nearby donors fast.

**Success metrics** *(set real targets after launch; these are the things to measure)*
- Needs posted vs. needs verified vs. needs fulfilled (funnel).
- Median time from "need live" → "first donation" and → "fulfilled".
- Blood: median time from request → matched donor confirmed.
- Donor repeat rate; % of donors reaching Silver/Gold.
- Fraud/dispute rate on confirmed donations (must stay low — this is the trust signal).

---

## 4. Users & Personas

**Donor (mobile).** Wants to help but is busy and slightly skeptical. Needs to quickly see
credible, nearby, specific needs; give in a couple of taps; and get proof it landed. Motivated by
visible impact, a progress bar, and recognition (trust tier, certificates).

**Beneficiary (mobile).** An individual with a genuine need (medical funds, education, groceries).
Needs a simple way to post, get verified, share a UPI/QR, and confirm what they received.

**Institution (web panel).** NGO, hospital, blood bank, or orphanage. Posts requests at some
scale (blood needs, funding, meal slots), may also donate, and needs a credible verified badge.

**Admin (web console).** The platform's trust gatekeeper. Verifies needs and institutions,
resolves donation-confirmation disputes, and can override. Their throughput is a real constraint —
the verification UX must be fast.

**Volunteer (phase 2).** Gives time, not money — scribe for exams, career mentor. Earns
volunteer records/certificates.

---

## 5. Scope & Build Order

**In scope for v1:** all flows — Money, Blood, Kits, Goods, Meal slots, Q&A, Volunteering,
Trust tiers & certificates — across all three surfaces (mobile app, institution panel, admin console).

**Important:** "all flows in v1" describes the *document's* scope. The *build* is sequential —
each Claude Code session ships one thing. The order below exists so no session is ever ambiguous
about what to build next. See `TASKS.md` for the task-level breakdown.

**Recommended build order (each builds on the last):**

1. **Foundations** — repo, roles/auth, the shared `Need` engine + lifecycle, admin verification.
   *(Everything else plugs into this.)*
2. **Money needs** — post → verify → UPI/QR → proof upload → beneficiary confirm → progress bar.
   *(Proves the whole core loop end-to-end.)*
3. **Kits** — money-per-kit and buy-&-deliver modes; kit definitions; funded/needed progress.
4. **Blood module** — donor blood profile + eligibility + geo-matched notifications + response flow.
5. **Meal-slot booking** — institution slot calendar + booking + lock + admin approval.
6. **Goods / unused items** — post item → claim → handoff confirmation.
7. **Trust tiers & certificates** — built on the now-existing confirmed-donation history.
8. **Community Q&A + Volunteering (scribe / career)** — the community layer.

> Rationale: 1–2 prove the core loop and the trust mechanic once, so every later flow reuses
> proven pieces. Blood and meal-slot are the two custom modules and come after the engine is solid.

---

## 6. Core "Need" Engine (shared lifecycle)

Everything in the platform is a **Need**. One entity, one lifecycle, with a `type` that selects
type-specific fields and rules. This engine is the spine of the whole system — every flow reuses it.

### 6.1 The `Need` entity — shared fields

| Field | Notes |
|---|---|
| `id` | unique |
| `type` | MONEY / BLOOD / KIT / GOODS / MEAL_SLOT / SKILL_REQUEST / QUESTION |
| `title`, `description` | |
| `posted_by` | a user (beneficiary) **or** an institution |
| `status` | see 6.2 |
| `urgency` | Normal / Urgent / Emergency — **admin/institution-verified, not self-declared**; drives feed priority & notifications (D-012) |
| `location` | city + area (baseline from poster); optional precise geo; for BLOOD, usually the linked institution's location |
| `linked_institution` | optional — hospital / blood bank / NGO / orphanage that can co-verify (D-008) |
| `photos[]` | up to 5 images of the situation/kit/item, uploaded via the signed-URL object-storage pipeline (D-021) — implements the `proof_documents[]` concept sketched in v0.1, scoped to images for now (bill/ID document upload is a later extension of the same mechanism) |
| `admin_verified` | boolean — set by admin |
| `institution_verified` | boolean — set by the linked institution (D-008) |
| `payload` | type-specific object (6.4) |
| `created_at`, `updated_at` | |

### 6.2 Lifecycle — shared by every type

```
DRAFT → PENDING_VERIFICATION → LIVE → PARTIALLY_FULFILLED → FULFILLED
                    ↘ REJECTED        ↘ EXPIRED / CANCELLED (terminal)
```

- **DRAFT** — being created, not submitted.
- **PENDING_VERIFICATION** — submitted; awaiting admin (and/or linked-institution) verification.
- **LIVE** — verified; visible to donors.
- **PARTIALLY_FULFILLED** — some but not all met (₹5k of ₹1L; 12 of 50 kits).
- **FULFILLED** — target met.
- **REJECTED** (failed verification) / **EXPIRED** (deadline passed) / **CANCELLED** (by poster/admin) — terminal.

Transitions are identical for every type; only the **fulfilment rule** differs (see 6.4).
**REJECTED requires a mandatory reason** (D-017), shown to the poster and synced live to all surfaces.

### 6.3 Verification model
- Every Need must be **admin-verified** before it can go LIVE.
- If `linked_institution` is set, that institution can **also verify**. For **BLOOD**, institution
  verification **fast-tracks** the need to LIVE for urgent cases; admin still reviews and can override (D-008).
- Both `admin_verified` and `institution_verified` are recorded, so trust provenance is visible.

### 6.4 Type-specific payloads & fulfilment rules

| `type` | key payload fields | fulfilment rule |
|---|---|---|
| MONEY | `target_amount`, `raised_amount`, `upi_id`, `upi_qr` | `raised_amount ≥ target_amount` |
| BLOOD | `blood_group`, `units_needed`, `urgency`, hospital ref | required units matched & confirmed |
| KIT | `kit{contents, cost_per_kit}`, `kits_needed`, `kits_funded`, `mode(money\|deliver)` | `kits_funded ≥ kits_needed` |
| GOODS | `item`, `condition`, `photos[]` | claimed + handover confirmed |
| MEAL_SLOT | `slot{date, meal_type, capacity, cost}` | slot booked + confirmed |
| SKILL_REQUEST | `skill(scribe\|mentor)`, `when`, `where` | volunteer matched *(phase 2)* |
| QUESTION | `body`, `tags[]` | n/a — community *(phase 2)* |

### 6.5 The `Contribution` entity — a donor acting on a Need

| Field | Notes |
|---|---|
| `id` | |
| `need_id` | which Need |
| `donor_id` | |
| `kind` | money / blood / kit / goods / meal_slot |
| `amount` / `units` / `kits` | what was given |
| `proof` | UTR + screenshot (money) — **UTR must be unique; no duplicate uploads** (D-019); handover photo (goods), etc. |
| `status` | PENDING_CONFIRMATION → CONFIRMED / REJECTED |
| `confirmed_by` | **beneficiary** (default) or **admin** (override) — D-002 |
| `created_at` | |

A **CONFIRMED** Contribution updates the Need's progress (`raised_amount`, `kits_funded`, units…)
and may advance it PARTIALLY_FULFILLED → FULFILLED.

### 6.6 Live status sync (D-008)
Status lives in the backend as the **single source of truth**. Every surface — donor mobile,
institution panel, admin console — **subscribes over WebSockets** and re-renders on change. No
polling, no stale views.

### 6.7 Location model (D-010)
- Captured at **registration**: the donor's **permanent ("go-to") location** — city + area.
  **This registered location is the basis for notifications; no real-time GPS / live tracking.**
- A Need carries a location: for an individual, only the **area** shows publicly; for BLOOD, the
  **linked institution's** location (public).
- The **donor sees the exact donation location** (hospital / pickup / delivery) once the need is
  **admin-approved or the donor engages** — so they know where to go. An individual's exact address
  stays private until then.
- v1 blood notifications target **all eligible donors whose permanent location is in the request's
  city** (radius/SOS deferred).

### 6.8 Urgency, feed priority & completion (D-012, D-013)
- **Urgency:** Normal / Urgent / Emergency. **Emergency** needs are pinned/prioritised in the feed
  **until fulfilled** and notify eligible donors. Urgency is **admin/institution-verified, not
  self-declared** (anti-gaming).
- **Feed ranking:** urgency → recency (proximity added later, when radius exists).
- **"Eligible" for notifications:** BLOOD = matching group + eligibility + city; other types = donors
  in the request's city (+ anyone opted into that cause).
- **Completion:** a need auto-closes at 100%, stops accepting more, and moves to the **Completed**
  section (which doubles as a public **impact wall**). Deadline passed unfunded → **EXPIRED** (re-submittable).

---

## 7. Money Need flow

The first end-to-end loop through the shared engine (§5, §6) — proves post → verify → fund →
confirm works before any type-specific module (Blood, Kits, …) is built on top of it.

### 7.1 Payload fields (extends §6.4)

| Field | Notes |
|---|---|
| `target_amount` | required at submission; positive integer (paise or whole ₹ — whole ₹ for v1) |
| `raised_amount` | **server-computed only** — never accepted from the client on create/edit; starts at 0 |
| `upi_id` | required at submission — the beneficiary's UPI ID, shown to donors (D-001) |
| `upi_qr` | optional — a QR image for the same UPI ID, alongside the deep-link (D-009) |
| `deadline` | optional — if set, an unfulfilled MONEY need past its deadline auto-**EXPIRES** (D-013) |

`deadline` lives as a **shared `Need` field** (not nested in `payload`), not because every type
uses it yet, but because the lifecycle engine (§6.2) needs to read it generically to drive the
EXPIRED transition without knowing type-specific payload shapes. KIT will reuse it in Milestone 3;
other types leave it null.

A `MONEY` need cannot move DRAFT → PENDING_VERIFICATION (submit) without `target_amount` and
`upi_id` set.

### 7.2 The donate step (no gateway, D-001)

1. Donor sees the need's UPI ID / QR and a **"Pay via UPI"** action that opens a UPI deep link
   (`upi://pay?pa=<upi_id>&pn=<beneficiary_name>&am=<amount>&cu=INR&tn=<need_title>`, D-009) —
   handled client-side, no backend call.
2. Donor pays **directly, outside the platform**, then comes back and submits proof: `amount`,
   `utr`, and a proof screenshot. This creates a `Contribution` (§6.5) in `PENDING_CONFIRMATION`.
3. **UTR must be unique platform-wide** — enforced as a DB unique constraint (D-019), not just a
   flag, so two uploads of the same UTR can never both succeed even under a race.
4. A need only accepts new contributions while `LIVE` or `PARTIALLY_FULFILLED` — once `FULFILLED`
   it stops accepting more (D-013).

> Proof-screenshot storage: the real upload pipeline (object-storage bucket + CDN, per CLAUDE.md
> §6) is a cross-cutting concern shared by every flow that uploads images/docs, not Money-specific.
> Until that pipeline exists, `Contribution.proofUrl` is stored as a plain string (client-supplied
> URL) — real signed-upload support is a TODO for whenever the storage cross-cutting task is built.

### 7.3 Confirmation (D-002)

- The **beneficiary** (the need's `postedBy`) confirms or rejects a `PENDING_CONFIRMATION`
  contribution. **Admin (not Staff — this is an override, D-018) can also confirm/reject any
  contribution**, e.g. if the beneficiary is unresponsive or disputes it.
- On **confirm**: `raised_amount += amount`, clamped so it never exceeds `target_amount` (avoids
  the awkward >100% display D-013 is trying to avoid). If the clamped `raised_amount` reaches
  `target_amount`, the need moves `→ FULFILLED`; otherwise, if this is its first confirmed
  contribution, `→ PARTIALLY_FULFILLED`.
- On **reject**: the contribution is marked `REJECTED`; `raised_amount` is untouched. Unlike
  rejecting a *Need* (D-017), rejecting a *Contribution* does not require a reason in v1 — the
  donor can just re-submit with a corrected UTR/screenshot.

### 7.4 Progress & completion

- Every MONEY need's card/detail shows a public progress bar: `raised_amount ÷ target_amount`.
- **Auto-close at 100%** → `FULFILLED`, listed in the public **Completed** section (impact wall,
  D-013) — not built this milestone, but the state transition it depends on is.
- **Deadline passed, still `LIVE`/`PARTIALLY_FULFILLED`** → `EXPIRED`. Checked lazily whenever a
  need is read (no scheduler/cron infra yet) rather than on a timer. The beneficiary can
  **re-submit**: `EXPIRED → DRAFT` (edit — e.g. push the deadline out — then submit again through
  the normal flow).

---

## 8. Blood module (eligibility + geo-matching)

The one genuinely custom module (CLAUDE.md §3) — everything else rides the shared `Need`/
`Contribution` engine almost unchanged; Blood adds a donor health profile, an eligibility
computation, geo+eligibility-matched push notifications, and a respond-and-confirm flow instead
of a donate-and-confirm one (no money or kits involved).

### 8.1 Donor blood profile (D-005)

New fields on `User` — **opt-in**, not part of general registration; a `USER` only fills these in
if they want to appear as a blood donor:

| Field | Notes |
|---|---|
| `bloodGroup` | one of the 8 standard groups (A/B/AB/O × +/−) |
| `dateOfBirth` | needed for the 18–65 age eligibility rule |
| `gender` | needed because the India gap rule differs by gender (D-005: ~90d men / ~120d women) — not itself decided in D-005, added here to make that rule computable; treated as sensitive as blood group (CLAUDE.md §7) |
| `lastDonationDate` | nullable — no prior donation recorded means no gap-rule block |
| `availableToDonate` | boolean toggle, defaults true once a profile exists — a donor can pause without deleting their profile |
| `expoPushToken` | for the notification match below (D-016); set when the app registers for push |

A `User` with no `bloodGroup` set has no blood profile and is never matched — filling in the
profile is what "becoming a blood donor" means here.

### 8.2 Eligibility computation (India gap rules, D-005)

Computed server-side, on demand (not stored) from the fields above:

- **Age**: `18 ≤ age ≤ 65`, from `dateOfBirth`.
- **Gap**: no `lastDonationDate`, **or** at least `90` days (men) / `120` days (women) since it.
- **Availability**: `availableToDonate = true`.
- A donor missing `bloodGroup`/`dateOfBirth`/`gender` (no profile) is simply never a match
  candidate — not "ineligible," just not in the pool.

Eligibility is a pure function of these fields at request time — it is **not** cached on the
`Need` or the `User`, since it changes independent of any action on the request (a donor becomes
eligible again purely by the calendar).

### 8.3 The BLOOD `Need` (D-008, D-010, D-012)

Payload (extends §6.4): `{ blood_group, units_needed, units_fulfilled }` —
`units_fulfilled` is server-computed, same tamper-guard pattern as `raised_amount`/`kits_funded`.
Fulfilment rule: `units_fulfilled ≥ units_needed`.

Reuses shared `Need` fields rather than inventing blood-specific ones:

- **Urgency** (§6.8, D-012) is the existing shared field — Emergency blood requests pin to the
  top of the feed and are what triggers notifications (§8.4), same mechanism as any other
  Emergency need, not a parallel system.
- **`linkedInstitution`** (D-008) — a hospital/blood bank can be linked to a BLOOD need and
  **verify it directly**; that alone moves it to `LIVE` — **this is what "fast-track" means**:
  the institution doesn't have to wait for admin. Admin verification remains available as an
  independent, parallel path (either one is sufficient); `institutionVerified` and
  `adminVerified` are recorded separately (§6.3) so which path a given need took stays visible,
  and admin retains the reject/override power regardless of which path got it live.
- **Location** (`city`/`area`, D-010) — the linked institution's location if set, else the
  poster's. The donor sees the **exact** donation location (hospital/pickup point) once they
  respond (§8.5) — before that, the public feed shows only the area, same rule as an individual
  Money/Kit need.

### 8.4 Matching & notifications (D-005, D-010, D-016)

When a BLOOD need goes `LIVE` (admin or institution verification, §6.3): find every `User` with a
matching `bloodGroup`, computed-eligible (§8.2), permanent location in the need's city (D-010 —
no radius/GPS), and a stored `expoPushToken`. Send each an **Expo push notification**; Emergency
urgency uses the high-priority channel (D-016) so it stands out. No SMS/email fallback in v1.
This is a **one-time push on verification**, not a live subscription — re-notifying on later
changes (e.g. urgency escalation) is a v2 concern, not built here.

### 8.5 Respond → connect → confirm (replaces donate → confirm for this type)

No money or kit count — a `Contribution` with `kind: BLOOD` and a `units` count (usually 1) is a
donor's **pledge to donate**, not a payment:

1. **Respond** — an eligible donor taps "I can donate." Creates a `PENDING_CONFIRMATION`
   `Contribution`. This *is* the donor's consent to share their response with the
   beneficiary/institution (CLAUDE.md §7 — no separate consent step; the action itself is the
   opt-in, same pattern as choosing to fill in a blood profile in the first place).
2. **Connect** — once responded, the donor already has the exact donation location (§8.3); the
   beneficiary/institution can see the donor's contact info to coordinate. No in-app messaging
   built here — coordination happens by phone, same as the rest of v1.
3. **Confirm** — after the actual donation, the beneficiary/institution/admin confirms
   (D-002/D-018, same permission model as Money/Kit). On confirm: `units_fulfilled += units`
   (clamped at `units_needed`, same pattern as §7.3/§9.3), **and** the donor's
   `lastDonationDate` resets to now — this is the "eligibility reset" that takes them out of the
   matching pool for the next 90/120 days.
4. **Certificate** — a confirmed blood `Contribution` is exactly the record Trust tiers &
   certificates (§14, Milestone 7) will read from later; no certificate generation is built in
   this milestone, matching the existing build order (D-006: platform record, not an official
   document, whenever it is built).

### 8.6 Privacy (CLAUDE.md §7)

Blood group + location are sensitive health data. A donor's identity/contact info is only ever
shown to the beneficiary/institution **after** that donor has responded (§8.5.1) — never as part
of browsing or the notification itself. `gender`/`dateOfBirth` (§8.1) are collected solely to
compute eligibility and are never shown to anyone but the donor themselves.

---

## 9. Kit flow (grocery / education)

Grocery and education kits — both funding modes committed in D-004. Reuses the same `Need`/
`Contribution` engine as Money (§6, §7); a `KIT` need just carries different payload fields and a
different fulfilment unit (kits, not currency).

### 9.1 Payload fields (extends §6.4)

| Field | Notes |
|---|---|
| `contents` | free text — what's in one kit (e.g. "rice, dal, oil, soap — 1 month's groceries") |
| `cost_per_kit` | required at submission; positive integer (₹) |
| `kits_needed` | required at submission; positive integer |
| `kits_funded` | **server-computed only**, like `raised_amount` in §7.1 — never accepted from the client; starts at 0 |
| `mode` | required at submission — `MONEY` or `DELIVER` (D-004); fixed for the need's lifetime, not editable after submission |
| `upi_id` | required at submission **when `mode: MONEY`** — same role as MONEY's `upi_id` (§7.1), the donor has to pay it somewhere. Irrelevant (and not required) when `mode: DELIVER`. |

`deadline` (shared `Need` field, §7.1) applies here too — an unfulfilled KIT need past its
deadline auto-**EXPIRES**, same as Money (D-013), same lazy-check-on-read mechanism.

### 9.2 The two modes (D-004)

- **`mode: MONEY`** — a donor funds N kits at `cost_per_kit` each (total = `N × cost_per_kit`),
  paid via UPI deep-link same as Money (§7.2, D-009), then submits the UTR as proof. Same
  UTR-uniqueness rule as Money (D-019).
- **`mode: DELIVER`** — a donor pledges to physically buy and deliver N kits themselves. No money
  moves through the platform at all — no UPI, no UTR. The pledge itself is the `Contribution`;
  confirmation happens on **physical handover**, not payment.

Both modes produce a `Contribution` with `kind: KIT` and a `kits` count. Only `MONEY`-mode
contributions carry an `amount` (server-computed as `kits × cost_per_kit`, same audit-worthy
principle as Money — CLAUDE.md §7) and a `utr`; `DELIVER`-mode contributions have neither.

### 9.3 Confirmation & fulfilment

Same shared pattern as Money (§7.3): the beneficiary (need's `postedBy`) confirms or rejects a
`PENDING_CONFIRMATION` contribution; Admin can override (not Staff — D-018). On confirm:
`kits_funded += kits`, clamped at `kits_needed`. The need moves `LIVE → PARTIALLY_FULFILLED` on
the first confirmed contribution, `→ FULFILLED` once `kits_funded` reaches `kits_needed` — the
same `assertTransition`-driven lifecycle as every other type (§6.2). A need stops accepting new
contributions once `FULFILLED`, same as Money (D-013).

### 9.4 Progress display

Same principle as Money's progress bar (§7.4), different unit: **"X of Y kits funded/delivered"**
instead of a ₹ amount. `DELIVER`-mode kits still count toward the same `kits_funded` total as
`MONEY`-mode ones — the beneficiary doesn't care how a kit got funded, only that it did.

---

## Appendix A — Design System (one shared theme, all surfaces)

**Principle (D-014):** the donor mobile app, institution/hospital web panel, and admin console all use
**one design system** and **one backend/API**. Same theme, same components, consistent data
everywhere. No surface defines its own colours or components.

### A.1 Colour roles *(starting palette — adjust hex, keep the roles)*
- **Primary** — brand + primary actions (e.g. a trustworthy teal/green `#0E7C66`).
- **On-primary** — text/icons on primary (`#FFFFFF`).
- **Accent** — secondary highlights (e.g. `#F2A900`).
- **Success** green · **Warning** amber · **Danger/Emergency** red (`#D7263D`) · **Info** blue.
- **Neutrals** — background, surface, border, text-primary, text-secondary (a gray ramp).
- **Rule:** reserve **red for danger / emergency / blood urgency only**, so urgency reads instantly.

### A.2 Typography
- One family covering **Latin + Devanagari (Hindi) + Telugu** glyphs (e.g. the Noto Sans family).
- Scale: Display / H1 / H2 / Body / Caption · weights: Regular / Medium / Bold.

### A.3 Spacing, radius, elevation
- Spacing scale (4-based): 4 / 8 / 12 / 16 / 24 / 32.
- Corner radius consistent (e.g. 12); a small, consistent elevation set for cards.

### A.4 Shared component library
Buttons (primary / secondary / danger), inputs, **need card**, **profile card**, chips/tags
(need type, urgency), **progress bar** (money/kit), badges (verified, trust tier), avatars,
app bar, modals/bottom-sheets, and a **bottom-tab nav**: Home · Search · Activity · Profile.

### A.5 Required states (everywhere, designed — never default)
Loading (skeletons) · Empty · Error · Success.

### A.6 Motion & accessibility
- Motion subtle and fast (150–250ms) via Reanimated; no janky transitions.
- Min tap target ~44px; sufficient contrast; support dynamic font scaling.

---

## Changelog

- v0.9 — Added Section 8 (Blood module): donor blood profile (incl. `gender` — new field, needed
  to compute D-005's gender-differentiated gap rule, not itself previously decided), eligibility
  computation, BLOOD `Need` payload, geo+eligibility-matched Expo push on verification (D-016),
  respond→connect→confirm flow replacing donate→confirm for this type, eligibility reset on
  confirm, privacy notes (CLAUDE.md §7).
- v0.8 — §6.1: `proof_documents[]` (sketched since v0.1, never implemented) realized as
  `photos[]` — up to 5 images, any need type, via the D-021 signed-URL pipeline. Wired into need
  creation (not just donation-time proof) on mobile and web-panel, viewable everywhere.
- v0.7 — Added Section 9 (Kit flow, out of numeric order ahead of §8): payload fields incl. the
  server-computed `kits_funded`, both funding modes (D-004 — money-per-kit vs buy-&-deliver),
  confirmation/fulfilment reusing the Money pattern, progress display in kit units.
- v0.6 — Added Section 7 (Money Need flow): payload fields (incl. shared `deadline`), donate step
  (UPI deep-link, UTR uniqueness), confirmation + admin override, progress bar, auto-close/expiry/
  resubmit.
- v0.5 — Auth/notifications/roles/UTR decisions (D-015…D-019): OTP, Expo push + emergency priority +
  WhatsApp, mandatory rejection reasons (live), Admin+Staff RBAC, UTR uniqueness.
- v0.4 — Added Appendix A (shared design system, D-014) and gap register (O-5…O-10).
- v0.3 — Added `urgency` to the Need entity and Section 6.8 (urgency, feed priority, completion).
- v0.2 — Added Section 6 (core Need engine): entity, lifecycle, verification, type payloads,
  Contribution entity, live sync, location model.
- v0.1 — Initial draft: vision, problem, goals, personas, scope & build order. Sections 6+ mapped.
