# TASKS.md — Task Breakdown

> One task ≈ one Claude Code session-sized chunk. Check items off as they're done.
> Detailed sub-tasks under each milestone get filled in **after** the matching PRD section is written,
> so we break down against real requirements, not guesses.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done

---

## Milestone 0 — Project setup
- [x] Confirm tech stack (resolve Open Decision O-1) and record in DECISIONS.md — D-011, reconfirmed
- [x] Pick a real project name (O-2); rename placeholders — DonationPlatform (app.json, package.json, HTML titles)
- [x] Initialise repo structure (mobile app / web-panel / admin / backend / docs)
- [x] Set up backend + PostgreSQL skeleton — Express + TypeScript + Prisma; migration applied, verified locally
- [x] Auth + role model (Donor, Beneficiary, Institution, Admin) — phone-OTP (static dev code) + Admin/Staff RBAC (D-018); see D-020

## Milestone 1 — Core "Need" engine  *(write PRD §6 first)*
- [x] Data model for `Need` + shared lifecycle (states, transitions) — `backend/prisma/schema.prisma`, transitions enforced in `src/lib/needLifecycle.ts`
- [x] Admin verification flow (PENDING_VERIFICATION → LIVE / REJECTED) — `POST /api/admin/needs/:id/verify|reject` (Admin+Staff, D-018); reject requires a reason (D-017)
- [x] Generic "browse live needs" list (donor mobile) — `mobile/src/screens/NeedsFeedScreen.tsx` (FlashList), backed by `GET /api/needs`
- [x] Test the full lifecycle end-to-end — curl-tested against the real (Railway) Postgres DB: draft isolation, submit, RBAC on verify/reject, mandatory rejection reason, visibility rules, staff-vs-admin permission split

## Milestone 2 — Money needs  *(write PRD §7 first)*
- [x] Post a money need (target, UPI) — `mobile/src/screens/CreateMoneyNeedScreen.tsx`; QR + proof-doc upload deferred to the object-storage cross-cutting task (no bucket/CDN pipeline yet)
- [x] Donor donates → upload UTR — UPI deep-link (D-009) + UTR proof; `mobile/src/screens/NeedDetailScreen.tsx` / `POST /api/needs/:id/contributions`; screenshot upload deferred with proof docs above
- [x] Beneficiary confirms receipt; admin override — `POST /api/contributions/:id/confirm|reject` (D-002); mobile UI for beneficiary, backend-only for admin override (no admin-console UI yet)
- [x] Public progress bar (raised ÷ target); partial fulfilment — `mobile/src/components/ProgressBar.tsx`; clamped-at-target fulfilment logic in `backend/src/routes/contributions.ts` (D-013)
- [x] Test every API in this flow — curl-tested end-to-end against the live Railway DB: submit-gating, payload tamper-guard, UTR uniqueness (D-019), RBAC on confirm/reject (donor/staff blocked, beneficiary/admin allowed), overshoot clamping, FULFILLED lockout, feed exclusion, deadline expiry + resubmit

## Milestone 3 — Kits  *(write PRD §9 first)*
- [x] Kit definition (contents, cost/kit, kits needed) — `backend/src/lib/kitNeed.ts`, `mobile/src/screens/CreateKitNeedScreen.tsx`
- [x] Mode = money-per-kit; mode = buy-&-deliver — `mode` fixed at submission (D-004); money-mode needs a `upi_id` (caught mid-build — a money-per-kit need needs somewhere to actually receive payment)
- [x] Funded/needed progress + fulfilment confirmation — shared `computeFulfilment` in `backend/src/routes/contributions.ts`, reused from Money's pattern; `ProgressBar` generalized with a `label` override for kit units
- [x] Test both modes — curl-tested end-to-end against the live Railway DB: submit-gating (incl. the upi_id fix), tamper-guard on `kits_funded`, money-mode UTR-required/deliver-mode UTR-forbidden validation, confirm/reject/override RBAC, overshoot clamping, FULFILLED lockout, UTR uniqueness across kit contributions

## Milestone 4 — Blood module  *(write PRD §8 first)*
- [x] Donor blood profile (group, DOB→age, gender, availability) — `PATCH /api/auth/me`
  (`backend/src/routes/auth.ts`); `lastDonationDate` deliberately excluded from self-edit
  (anti-gaming, same principle as D-012's urgency rule); mobile `BloodProfileScreen.tsx`
- [x] Eligibility computation (India gap rules) — `backend/src/lib/bloodEligibility.ts`: age
  18–65, 90-day (male) / 120-day (female/other, conservative default) donation gap; surfaced as
  `bloodEligibility` on `/auth/me` and `/auth/otp/verify`
- [x] Blood request (group, units, urgency, location) — BLOOD `Need` type via the shared engine;
  urgency set via new `POST /api/needs/:id/urgency` (admin/staff or linked institution only,
  D-012); location reuses shared city/area fields
- [x] Geo + eligibility match → push notifications — `backend/src/lib/bloodMatching.ts`
  (city + blood-group match, then `computeEligibility` filter) → Expo push (D-016; no
  FCM/APNs credentials needed directly), best-effort/non-blocking; triggered on institution
  fast-track verify, admin verify, and urgency escalation to EMERGENCY on a LIVE need
- [x] Donor "I can donate" response + connect + eligibility reset — respond via
  `POST /api/needs/:id/contributions` (kind BLOOD, units); beneficiary/admin confirm sets
  donor's `lastDonationDate` transactionally, resetting their eligibility gap
- [ ] Post-donation certificate — deferred to Milestone 7 (Trust tiers & certificates), same
  mechanism will cover all confirmed-contribution kinds, not blood-specific
- [ ] Privacy/consent handling for sharing donor details — not yet built; today confirming a
  BLOOD contribution surfaces the donor's name/phone to the beneficiary same as any other
  contribution, no separate consent gate
- [x] Test matching + notification + response — curl-tested end-to-end (profile → institution
  fast-track-verify LIVE → donor responds → institution confirms → PARTIALLY_FULFILLED with
  correct units → `lastDonationDate` reset); push send path is best-effort/logged, not asserted
  against a live device in this pass

## Milestone 5 — Meal-slot booking  *(write PRD §10 first)*
- [ ] Institution defines slots (date, meal type, capacity, cost)
- [ ] Donor books a slot → admin approves → slot locks (no double-booking)
- [ ] Test booking + lock

## Milestone 6 — Goods / unused items  *(write PRD §11 first)*
- [ ] Post an item; claim; handoff confirmation

## Milestone 7 — Trust tiers & certificates  *(write PRD §14 first)*
- [ ] Tier logic (Bronze/Silver/Gold from confirmed history)
- [ ] Certificate generation (worded as platform records)

## Milestone 8 — Community layer  *(write PRD §12–13 first)*
- [ ] Q&A forum (ask/answer, admin moderation)
- [ ] Volunteering: scribe requests + career mentoring

## Cross-cutting (revisit throughout)
- [ ] Institution web panel (PRD §16) — *partial:* post/track MONEY, KIT **and** BLOOD needs +
  confirm contributions + photo upload, on par with mobile
  (`web-panel/src/pages/MyNeedsPage.tsx`/`CreateMoneyNeedPage.tsx`/`CreateKitNeedPage.tsx`/
  `CreateBloodNeedPage.tsx`); BLOOD needs auto-link to the posting institution and can be
  self-verified fast-track from `NeedDetailPage.tsx` (D-008); KYC onboarding (D-007) not started
- [ ] Admin console (PRD §15) — *partial:* Needs tab wired (verification queue + status browser +
  contribution override + urgency control, `admin/src/pages/NeedsPage.tsx`/`NeedDetailPage.tsx`,
  all blood-aware); **Admin**-only Post a need tab (money + kit + blood + photos, on behalf of a
  poster without their own account, `admin/src/pages/PostNeedPage.tsx`); settings/analytics
  screens not started
- [ ] Notifications system (PRD §17)
- [ ] Security & privacy pass (PRD §20)
- [ ] Analytics & metrics (PRD §21)
