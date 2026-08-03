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
- [x] Institution defines slots (date, meal type, cost) — a `MEAL_SLOT` need takes a bounded list
  of dates at creation (capped 60), one `MealSlot` child row per date, all starting `OPEN`
  (`backend/prisma/schema.prisma`, `src/lib/mealSlotNeed.ts`); `capacity` deliberately not
  modeled — v1 is one booking per date, not multiple slots per date
- [x] Donor books a slot → beneficiary/admin confirms → slot locks (no double-booking) — booking
  is a dedicated `POST /api/needs/:id/meal-slots/:slotId/book` (not a branch of the generic
  contributions endpoint) using a **conditional UPDATE** (`WHERE status='OPEN'`) inside the same
  transaction as the Contribution, not check-then-act (D-022); confirm flips `BOOKED →
  CONFIRMED` and advances `slots_confirmed`; **reject reopens the date** (`BOOKED → OPEN`,
  `contributionId` cleared) — the one place this type's confirm/reject differs from Money/Kit
- [x] Test booking + lock — curl-tested end-to-end including firing two donors' booking requests
  **concurrently** at the same slot: exactly one succeeded, the other got a clean 409; confirmed
  the winner, then tested reject-reopens-slot on a second date and successfully rebooked it
  immediately after

## Milestone 6 — Goods / unused items  *(write PRD §11 first)*
- [x] Post an item; claim; handoff confirmation — **no custom module needed** (unlike Blood/
  Meal-slot, CLAUDE.md §3): rides the shared engine exactly like Money/Kit with a fulfilment
  target of 1. `backend/src/lib/goodsNeed.ts` (payload: `item`, `condition`,
  server-computed-only `claimed`); claim is a `Contribution` with `kind: GOODS` via the existing
  generic `POST /:id/contributions` (a pledge, no amount/kits/units/utr, same principle as
  Blood's respond); on confirm the need jumps straight `LIVE → FULFILLED` (no
  `PARTIALLY_FULFILLED` — no partial state for "1 item, 1 claim"); deliberately **no
  claim-locking** (unlike Meal-slot's D-022) — multiple donors can submit competing pending
  claims, the beneficiary picks one to confirm and is expected to reject the rest
- [x] Test the flow — curl-tested end-to-end: post → submit → admin-verify → LIVE; donor claims
  (pending) → beneficiary confirms → need jumps straight to FULFILLED, `claimed: true`; verified
  a FULFILLED need correctly rejects further claims (409); verified reject path on a second need
  (claim rejected → need stays LIVE, `claimed` stays `false`, item still open to other donors)

## Milestone 7 — Trust tiers & certificates  *(write PRD §14 first)*
- [x] Tier logic (Bronze/Silver/Gold from confirmed history) — `backend/src/lib/trustTier.ts`,
  computed fresh on every read (never stored, same tamper-guard principle as every progress
  field), from a **confirmed** contribution count across every type combined (Money/Kit/Blood/
  Meal-slot/Goods); thresholds (5/15) isolated in one constants file so product can tune them
  without a schema change; surfaced on `/auth/me`, `/auth/otp/verify`, and admin's
  `GET /api/admin/users` (via a filtered `_count` on the contributions relation)
- [x] Certificate generation (worded as platform records) — **derived, not stored**: no new
  table, `GET /api/contributions/:id/certificate` computes it on read from a `CONFIRMED`
  Contribution + its Need + donor (only that donor or admin/staff can view, 409 if not yet
  confirmed); wording locked to D-006's "platform record, not official/medical/government/
  tax-deductible" language regardless of type or institution-verification (`backend/src/lib/
  contributionSummary.ts`); new `GET /api/contributions/mine` (PRD §14.3) — the first
  donor-side contributions query, needed to let a donor find their own certificates
- [x] Test the flow — curl-tested end-to-end: confirmed-contribution count → BRONZE tier surfaced
  correctly on `/me`; `GET /mine` returns the donor's contributions with need title/type;
  certificate fetch succeeds for the donor, 403s for an unrelated user, 409s for a still-pending
  contribution; admin's `/users` list shows the same tier computation

## Milestone 8 — Community layer  *(write PRD §12–13 first)*
- [x] Q&A forum (ask/answer, admin moderation)
- [x] Volunteering: SKILL_REQUEST need type + volunteer pledge flow

## Milestone 9 — Professional UX, Registration & Hardening
User-authored milestone spec (not written against a new PRD section — it hardens/polishes
everything Milestones 0–7 already built). Worked **one chunk per session**, per its own
instructions. Guardrails for every chunk: don't change/degrade existing curl-tested backend
behavior; one design system everywhere (D-014, red reserved for danger/emergency/blood only);
every screen gets all four states (loading/empty/error/success); builds stay green; static-OTP
dev behavior (D-015) untouched; `.env` stays untracked.

- [x] **Chunk 1 — Design-system foundation.** One tokens file per app (no monorepo/shared-package
  tooling exists, so "one tokens definition per app," not a cross-app package) mirroring PRD
  Appendix A: colors, a 4-based spacing scale, radius, a new typography scale (display/h1/h2/
  body/caption × weights), and a new elevation set. Found and fixed a real drift bug along the
  way — admin's `theme.ts` was missing `success`/`warning`/`info`/spacing entirely (web-panel and
  mobile had them; admin's had silently fallen behind). Noto Sans (Latin+Devanagari+Telugu, A.2):
  wired on web (a Google Fonts `@import` + font-family stack in both `index.css` files — free,
  the browser only fetches glyphs actually used) but **deliberately deferred on mobile** — no
  Hindi/Telugu text exists anywhere in the app yet (D-009's i18n framework was never started), so
  shipping a multi-script font with nothing to render against it would be dead weight; the
  typography *scale* (sizes/weights/line-heights) is real today and is what mobile now uses,
  just on the system font pending the actual i18n milestone. Built a `components/ui/` kit in
  all three apps — Button, Badge, Chip, Card, Input, Avatar, EmptyState, ErrorState, Skeleton,
  Toast(+Provider) — mobile as real components against the extended `theme.ts`, web-panel/admin
  as thin wrappers over CSS classes (same approach every existing page already uses, not a new
  CSS-in-JS layer). `ToastProvider` mounted at all three app roots. Refactored one trivial,
  clearly-scoped usage per app to prove the kit integrates (LoginScreen/LoginPage's buttons) —
  full screen-by-screen migration is Chunk 7, not this one. Builds green: `tsc -b`/`vite build`
  clean on web-panel + admin, `tsc --noEmit` + `expo export` clean on mobile; backend untouched
  (no backend work needed for this chunk) and confirmed still healthy.
- [x] **Chunk 2 — Navigation.** Mobile: React Navigation (native-stack + bottom-tabs), replacing
  HomeScreen's local view-switching. Web-panel: `react-router-dom` + sidebar layout. Admin:
  `react-router-dom` + sidebar (incl. a new Institutions nav item for Chunk 5).
- [x] **Chunk 3 — Donor registration & profile (mobile).** Post-OTP registration step
  (name/email/DOB/gender/blood group/permanent city+area, D-010); Profile tab; gate need-posting
  and blood-respond on a completed profile.
- [x] **Chunk 4 — Institution registration + KYC (web-panel), D-007.** Multi-step registration
  (org type/legal name/reg. no/Darpan ID where applicable/address/bank account + document
  upload via the existing signed-URL flow); backend `kycStatus`; block need-creation for
  non-APPROVED institutions; a "Verification status" screen.
- [x] **Chunk 5 — Admin approval of institutions, D-007.** Institutions queue (approve/reject-
  with-reason, D-017 pattern); Admin-vs-Staff permission call documented when made.
- [x] **Chunk 6 — Duplicate-response fix + global error handling.** Backend: at most one active
  `PENDING_CONFIRMATION` contribution per (donor, need) — closes the BLOOD/GOODS double-tap gap.
  Frontend: disabled/"already responded" button state; shared API-error wrapper (401/403/409/
  network blips) with friendly messages everywhere; real inline form validation.
- [x] **Chunk 7 — Screen-by-screen visual polish.** Bring every screen to the Appendix A bar
  (skeletons, empty/error states, professional cards, accessible tap targets, motion) — mobile
  first, one surface at a time, updating PROGRESS.md between surfaces.

## Milestone 10 — Community panel in the app menu  *(D-028)*
Client-requested, driven by a reference design of the mobile menu drawer.
- [x] Backend: `Helpline`, `SuccessStory`, `PlatformEvent` models + `EventMode` enum (migration
  `20260803190000_add_community_content`); `routes/community.ts` with authenticated public reads
  (`/menu`, `/helplines`, `/success-stories[/:id]`, `/top-supporters`, `/events[/:id]`) and
  ADMIN-only CRUD under `/api/admin/community` (STAFF read-only, D-018); `community` upload
  folder; `community:` cache namespace; `prisma/seedCommunity.ts` seeds the six design helplines.
- [x] Top Supporters — derived from CONFIRMED contributions with an `amount`, never stored.
  Exposes rank/name/photo/total, plus blood group only for donors who are publicly available to
  donate (CLAUDE.md §7).
- [x] Mobile: `SideDrawer` rebuilt to the reference design (Safety & Emergency, Trust &
  Transparency, Success Stories carousel with dots, Top Supporters, Upcoming Events, Make an
  Impact CTA); shared `components/CommunityBlocks.tsx`; six new screens — Helplines, Success
  Stories + detail, Top Supporters, Events (upcoming/past) + detail.
- [x] Mobile: "Create a Need" is a real, responsive control wired to the create-need chooser;
  only the heart is artwork (`assets/impact-heart.webp`, cropped from the supplied PNG).
- [x] Admin: Helplines, Success Stories and Events pages + `ImageCropper` (drag/zoom crop to the
  app's exact aspect ratios, exported as fixed-size WebP) + sidebar entries.
- [ ] Optional follow-up: a dedicated "show my blood group publicly" consent flag, if the
  `availableToDonate` proxy isn't the consent model wanted long-term (D-028).

## Cross-cutting (revisit throughout)
- [x] Institution web panel (PRD §16) — Complete: post/track MONEY, KIT, BLOOD, MEAL_SLOT, GOODS, and SKILL_REQUEST needs + confirm contributions + photo upload + KYC onboarding (D-007) + self-verification fast-track (D-008).
- [x] Admin console (PRD §15) — Complete: Needs verification queue + status browser + contribution override + urgency control + Admin-only Post a Need + Users list with trust tiers + Staff management + Forum moderation queue + KYC approvals queue + Analytics & metrics dashboard (`AnalyticsPage.tsx`).
- [x] Trust tiers & certificates (PRD §14) — Complete: backend + mobile fully wired (tier badge, "My contributions" tab, certificate view); admin shows tier in Users list.
- [x] Notifications system (PRD §17) — Complete: Expo push notifications wired for blood donor matching (`notifyEligibleBloodDonors`), contribution confirmations, and Q&A replies.
- [x] Security & privacy pass (PRD §20) — Complete: HTTP security headers via `helmet`, IP rate-limiting via `express-rate-limit`, strict role-based access control, payload validation & tamper-guards.
- [x] Analytics & metrics (PRD §21) — Complete: `GET /api/admin/analytics` and admin console `AnalyticsPage.tsx` KPI overview dashboard.
