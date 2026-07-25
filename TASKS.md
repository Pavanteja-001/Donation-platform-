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
- [ ] Kit definition (contents, cost/kit, kits needed)
- [ ] Mode = money-per-kit; mode = buy-&-deliver
- [ ] Funded/needed progress + fulfilment confirmation
- [ ] Test both modes

## Milestone 4 — Blood module  *(write PRD §8 first)*
- [ ] Donor blood profile (group, last-donation date, availability)
- [ ] Eligibility computation (India gap rules)
- [ ] Blood request (group, units, urgency, location)
- [ ] Geo + eligibility match → push notifications (FCM)
- [ ] Donor "I can donate" response + connect + post-donation certificate + eligibility reset
- [ ] Privacy/consent handling for sharing donor details
- [ ] Test matching + notification + response

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
- [ ] Institution web panel (PRD §16) — *partial:* post/track a MONEY need + confirm contributions
  wired (`web-panel/src/pages/MyNeedsPage.tsx` etc.); KYC onboarding (D-007) not started
- [ ] Admin console (PRD §15) — *partial:* Needs tab wired (verification queue + status browser +
  contribution override, `admin/src/pages/NeedsPage.tsx`/`NeedDetailPage.tsx`); settings/analytics
  screens not started
- [ ] Notifications system (PRD §17)
- [ ] Security & privacy pass (PRD §20)
- [ ] Analytics & metrics (PRD §21)
