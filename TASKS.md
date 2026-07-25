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
- [ ] Data model for `Need` + shared lifecycle (states, transitions)
- [ ] Admin verification flow (PENDING_VERIFICATION → LIVE / REJECTED)
- [ ] Generic "browse live needs" list (donor mobile)
- [ ] Test the full lifecycle end-to-end

## Milestone 2 — Money needs  *(write PRD §7 first)*
- [ ] Post a money need (target, UPI/QR, proof docs)
- [ ] Donor donates → upload screenshot/UTR
- [ ] Beneficiary confirms receipt; admin override
- [ ] Public progress bar (raised ÷ target); partial fulfilment
- [ ] Test every API in this flow

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
- [ ] Institution web panel (PRD §16)
- [ ] Admin console (PRD §15)
- [ ] Notifications system (PRD §17)
- [ ] Security & privacy pass (PRD §20)
- [ ] Analytics & metrics (PRD §21)
