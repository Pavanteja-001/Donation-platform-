# PROGRESS.md — Session Handoff

> The most important file for surviving credit limits. Update it **before every session ends**.
> A new session reads this to know exactly where things stand. Keep the latest entry at the top.

---

### Session 10 — Milestone 1: the Need engine (data model, verification, browse feed)
**Done:**
- `backend/prisma/schema.prisma`: added `Need` model + `NeedType`/`Urgency`/`NeedStatus` enums
  (PRD §6.1–6.2). Migration `add_need_engine` applied — **against the real Railway Postgres DB**
  now configured in `backend/.env` (the user swapped in the actual `DATABASE_URL`; local Homebrew
  Postgres from Session 9 is no longer what's in use). Re-ran `npm run prisma:seed` against Railway
  too, since it's a separate database from the local one seeded in Session 9.
- `backend/src/lib/needLifecycle.ts`: explicit transition table enforcing PRD §6.2's lifecycle
  graph (`DRAFT → PENDING_VERIFICATION → LIVE → PARTIALLY_FULFILLED → FULFILLED`, with
  `REJECTED`/`EXPIRED`/`CANCELLED` as branches) — every status change goes through
  `assertTransition`, not just an unchecked field write.
- `backend/src/routes/needs.ts`: owner-facing endpoints — create (DRAFT), edit (DRAFT-only),
  submit (→ PENDING_VERIFICATION), cancel, get-one (visibility: owner, admin/staff, or public once
  LIVE+), and the public feed (`GET /api/needs`, LIVE + PARTIALLY_FULFILLED only, ranked Emergency →
  Urgent → Normal then recency per §6.8 — the ranking logic is live and tested even though nothing
  sets urgency away from NORMAL yet, since urgency-setting is admin/institution-verified per D-012
  and lands with the Blood module in Milestone 4).
- `backend/src/routes/admin.ts`: added the verification queue (`GET /admin/needs`, PENDING only)
  and `POST /admin/needs/:id/verify|reject` — both Admin **and** Staff per D-018 ("verify/accept"),
  reusing the same `requireRole(ADMIN, STAFF)` gate already on the router. Reject requires a
  `reason` (D-017, 400 without one).
- **Verified end-to-end against the live Railway DB with curl** (not just typecheck): draft needs
  invisible everywhere but to their owner; submit locks editing; donor gets 403 trying to
  verify/reject their own need; PENDING needs stay off the public feed until verified; verified
  needs appear on the feed; double-verify/double-submit correctly 409 (invalid transition);
  reject without a reason 400s, with a reason 200s and the reason is visible to the owner but the
  need 404s for an unrelated stranger; staff can verify but still can't touch `/admin/staff`.
- Mobile: `src/lib/api.ts` got `Need`/`fetchNeeds`; new `src/components/NeedCard.tsx` (urgency
  badge — red reserved for Emergency per Appendix A) and `src/screens/NeedsFeedScreen.tsx`
  (`@shopify/flash-list`, per CLAUDE.md's performance rules, with loading/empty/error states,
  pull-to-refresh). `HomeScreen` is now a header (greeting/role/logout) over the feed.
  `npx tsc --noEmit` clean; `npx expo export --platform ios` bundled successfully (650 modules).
- Cleaned up leftover unused default `React` imports across mobile files (automatic JSX runtime
  doesn't need them) that the IDE flagged as hints.

**Not done / caveat:** No simulator/device or browser tool was available to actually see the feed
render — verification is `tsc` + a successful Metro bundle export + the backend endpoints it calls
being curl-verified, not a real render. Worth running `npm run ios` and eyeballing it. Web-panel
and admin don't have a Need-related UI yet (not in Milestone 1's scope — Money-need posting/UPI/
progress-bar UI is Milestone 2).

**Next:** Milestone 2 — Money needs (PRD §7, not yet written — write it first): post a money need
(target, UPI/QR, proof docs), donor donates → upload screenshot/UTR, beneficiary confirms receipt
+ admin override, public progress bar, partial fulfilment. This is also where the `Contribution`
entity (PRD §6.5) and UTR-uniqueness constraint (D-019) get built.

---

### Session 9 — Milestone 0: repo scaffold, backend auth + RBAC, three app shells
**Done:**
- Reorganised the flat doc dump into the real repo layout (root: CLAUDE.md/TASKS.md/PROGRESS.md/
  START_HERE.md; `docs/`: PRD.md/DECISIONS.md/IDEAS.md) and ran `git init`.
- **Backend** (`/backend`): Node + Express + TypeScript + Prisma + PostgreSQL. `User` model with
  `role` enum (`USER`/`INSTITUTION`/`ADMIN`/`STAFF`, see D-020). Phone-OTP auth
  (`/api/auth/otp/request`, `/api/auth/otp/verify`, `/api/auth/me`) — **static dev OTP `123456`**,
  clearly marked `⚠️ DEV-ONLY` in `src/lib/otp.ts` with a TODO for a real rate-limited provider
  before launch (D-015). Admin/Staff RBAC (D-018) in `src/routes/admin.ts`: both roles can list
  users; only `ADMIN` can edit users, create/list/delete `STAFF`. Seed script provisions the
  founding admin. **Verified end-to-end locally**: migration applied against Postgres, seeded
  admin, and curl-tested the full flow — donor blocked from admin routes (403), staff can list
  users (200) but blocked from creating staff or editing users (403 both), wrong OTP rejected (401).
- **Mobile** (`/mobile`): Expo **prebuild/bare workflow** per D-011 — `ios/`/`android/` native
  projects generated and checked in, `app.json` set to DonationPlatform /
  `org.donationplatform.app`. Phone → OTP → home screen flow wired to the backend
  (`expo-secure-store` for the JWT). Self-registers as `USER`. `npx tsc --noEmit` clean.
- **Web-panel** (`/web-panel`) and **Admin** (`/admin`): Vite + React + TypeScript, same OTP flow.
  Web-panel self-registers as `INSTITUTION`. Admin has no self-registration — only existing
  Admin/Staff accounts can log in — and gates its "Staff accounts" tab/routes to `ADMIN` only,
  matching the backend enforcement. Both typecheck and `npm run build` clean.
- Shared starting design tokens (PRD Appendix A) duplicated into each app's `theme.ts`/`index.css`
  for now, with a TODO to extract into a shared package once it needs to stay in lockstep (D-014).
- Logged **D-020** (Prisma choice, single-`User`-table role model, Admin/Staff provisioning path).

**Not done / caveat:** No browser tool was available this session to click through the web-panel
and admin UIs interactively — verification was `tsc`/`vite build` (both clean) plus curl-testing
the backend endpoints the UIs call (which passed). Worth an actual click-through before trusting
the UI polish. Docker wasn't available either; migrations were verified against a local Homebrew
Postgres instead — `docker-compose.yml` is written and should work once Docker is available, but
wasn't itself tested.

**Next:** Milestone 1 — the `Need` engine (PRD §6): data model + shared lifecycle, admin
verification flow (PENDING_VERIFICATION → LIVE/REJECTED), generic "browse live needs" list on
mobile, end-to-end lifecycle test. Write PRD §7 (Money flow) first if not already done.

---

### Session 8 — Final consistency pass + kickoff
**Done:**
- Read CLAUDE.md, DECISIONS.md, PRD.md end to end; fixed staleness: PRD header (v0.5, confirmed name,
  updated status note) and reconciled push notifications to **Expo push (via FCM/APNs)** across CLAUDE.md,
  D-011, D-016. All files now consistent.
- Added **START_HERE.md** with repo file-placement + the first-session **kickoff prompt** (Milestone 0)
  and the reusable **resume prompt**.

**Status:** All docs consistent and build-ready. Only **O-10 (legal)** open.

**Next:** paste the kickoff prompt from START_HERE.md into Claude Code → **Milestone 0** (repo, OTP
auth with static dev code, Admin/Staff RBAC). Write PRD §7 (Money flow) just before Milestone 2.

---

### Session 7 — Auth, notifications, admin roles, UTR
**Done (D-015…D-019, resolves O-5…O-9):**
- Auth: phone **OTP**, static `123456` in dev. ⚠️ MUST replace + rate-limit before launch.
- Notifications: **Expo push**; **high-priority channel** for Emergency; **WhatsApp** for sharing.
- Rejections: **mandatory reason**, shown to poster, synced live everywhere.
- Admin RBAC: **Admin + Staff**; staff verify/accept + list all users, but can't edit users/settings,
  manage staff, or override (escalate to admin).
- **UTR uniqueness**: hard block (DB unique constraint), no duplicate uploads.
- PRD now **v0.5**. Only **O-10 (legal/compliance)** remains open.

**Next:** write **PRD §7 (Money flow)** — first buildable feature — or start **Milestone 0**
(repo, OTP auth with static dev code, roles/RBAC).

---

### Session 6 — Foundation finalized: shared design system + gap register
**Done:**
- D-014: **one shared design system + one backend** across donor mobile, institution/hospital panel,
  and admin console. Wrote **PRD Appendix A** (colour roles, type covering Telugu/Hindi, spacing,
  shared components, bottom-tab nav, required states). Resolves O-4.
- Ran a full consistency + gap check. Foundation is internally consistent end to end.
- Logged gap register **O-5…O-10** (auth, notification fallback, dispute UX, admin roles, UTR-verify
  limit, legal/compliance) so nothing is forgotten.
- PRD now **v0.4**.

**Status:** Planning **foundation is FINAL and consistent.** Not yet written (the remaining work):
per-flow specs §7–§13, cross-cutting §15–§24 (incl. schema §18 + APIs §19), and resolving O-5…O-10
— done just-in-time per milestone.

**Next:**
1. Write **PRD §7 (Money flow)** — first buildable feature — or
2. Start **Milestone 0** (repo, auth, roles) then **Milestone 1** (Need engine).

---

### Session 5 — Urgency, completion, design-system gap flagged
**Done:**
- D-012: urgency levels (Normal/Urgent/**Emergency**); Emergency pinned in feed until fulfilled +
  notifies eligible donors; urgency is **admin-verified, not self-declared** (anti-gaming).
- D-013 (resolves O-3): needs auto-close at 100% → **Completed** section (public impact wall);
  unfunded past deadline → EXPIRED (re-submittable).
- Added `urgency` field + PRD §6.8; PRD now v0.3.
- Flagged **O-4 (design system)** as the next real decision for the "professional/Swiggy-quality" bar.

**Next:**
1. Decide **O-4 design system** (recommended before building screens) — tokens, components,
   bottom-tab nav, loading/empty/error states.
2. Write **PRD §7 (Money flow)** — the first end-to-end loop.
3. Then §8 (Blood), §16 (Institution panel).

**Reminders to bake into build:** compress images on-device before upload; per-type "eligible"
definition for notifications; a public Completed/impact section.

---

### Session 4 — Location model refined
**Done:** Refined D-010 — notifications are based on the donor's **permanent registered location**
(no real-time GPS). Donor sees the **exact donation location** on approval/engagement; an individual's
exact address stays private until then. Updated D-010, CLAUDE.md, and PRD §6.7.

**Next:** unchanged — write **PRD §7 (Money flow)**, then §8 (Blood), §16 (Institution panel).
Optional: resolve **O-3** (over-fulfilment / deadline).

---

### Session 3 — Stack locked, PRD §6 written
**Done:**
- Resolved open decisions: **tech stack** (D-011: React Native/Expo prebuild, Railway, Postgres,
  R2/Supabase bucket + CDN, WebSockets, FCM) and **name** = DonationPlatform.
- Adopted UPI deep-link, tri-language (Telugu/Hindi/English), WhatsApp for v1 (D-009).
- Defined location model + v1 notification scope (D-010): city+area at registration; blood alerts to
  all eligible donors in the request's city; no radius/SOS yet.
- Wrote **PRD §6 — the core Need engine** (entity, lifecycle, verification, type payloads,
  Contribution entity, live sync, location model). PRD now at v0.2.

**Next (do this next session):**
1. Write **PRD §7 (Money Need flow)** in full — post → UPI deep-link/QR → proof (UTR) → beneficiary
   confirm → progress bar → partial fulfilment. Then **§8 (Blood)** and **§16 (Institution panel)**.
2. Optional: resolve **O-3** (over-fulfilment / deadline handling).
3. Once §7–§8 are specced, start **Milestone 0** (repo + auth + roles) then **Milestone 1** (Need engine).

---

### Session 2 — Institution KYC, blood flow, ideas backlog
**Done:**
- Added institution KYC requirements, type-specific (D-007): NGO/hospital/blood bank/orphanage
  upload name, reg. no, Darpan ID (NGOs), certificate PDF/JPEG, address, bank account, photos →
  admin-verified before posting.
- Defined blood request flow (D-008): need can be linked to a hospital/blood bank that can verify it
  (fast-tracks urgent cases) alongside admin; shows on both mobile + institution panels; status is a
  single source of truth pushed live to every panel.
- Created IDEAS.md (India-first enhancement backlog): UPI deep-link, privacy-first location sharing,
  Telugu/Hindi/English, WhatsApp, blood SOS escalating radius, fraud guards, and more.

**Next (do this next session):**
1. Still open: **O-1 tech stack** (React Native vs Flutter?) and **O-2 project name**.
2. Then write **PRD §6 (Core Need engine)** — the shared data model + lifecycle, now including
   `linked_institution`, multiple verification sources, and the live-sync requirement.
3. Then **PRD §8 (Blood)** and **§16 (Institution panel)** to expand D-007/D-008 into full specs.

---

### Session 1 — Planning & context setup
**Done:**
- Defined the product: an India-first donation + community-support platform.
- Fixed the three surfaces: donor/beneficiary mobile app, institution web panel, admin console.
- Established the core architecture: one `Need` object with a `type`, one shared lifecycle;
  BLOOD and MEAL_SLOT are the two custom modules.
- Made key decisions (see DECISIONS.md): direct UPI/QR payments, beneficiary-confirms donations,
  both kit modes, eligibility-aware blood matching, certificates as platform records.
- Wrote PRD §1–5 (vision, problem, goals, personas, scope & build order).
- Set up the context system: CLAUDE.md, PRD.md, TASKS.md, DECISIONS.md, PROGRESS.md.

**Next (do this next session):**
1. Resolve **O-1 tech stack** (mobile framework, backend, maps) → record in DECISIONS.md.
2. Pick a real **project name** (O-2).
3. Then either: write **PRD §6 (Core Need engine)** in detail, or start **Milestone 0** setup —
   whichever you prefer. The PRD section first is recommended so the build has a spec.

**Open questions to keep in mind:** O-1 stack, O-2 name, O-3 over-fulfilment/deadline handling.
