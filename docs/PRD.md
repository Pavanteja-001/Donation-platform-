# Product Requirements Document — DonationPlatform

**Status:** Living document · **Version:** 0.6 · **Region:** India (Andhra Pradesh first)

> Living document. Sections 1–7 and Appendix A (design system) are drafted. Sections 8+ are mapped
> in the ToC and written just before their build milestone. Update the version and changelog whenever
> a section changes.

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
| 8 | Blood module (eligibility + geo-matching) | ⬜ to write |
| 9 | Kit flow (grocery / education) | ⬜ to write |
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
| `proof_documents[]` | uploaded evidence (bills, IDs, etc.) |
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
