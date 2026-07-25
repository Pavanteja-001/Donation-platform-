# PROGRESS.md — Session Handoff

> The most important file for surviving credit limits. Update it **before every session ends**.
> A new session reads this to know exactly where things stand. Keep the latest entry at the top.

---

### Session 13 — Object storage: real proof-of-payment upload (D-021)
Closes the "proof-doc upload" TODO flagged in every session since Milestone 2 (Session 11).

**Done:**
- **D-021**: chose **Supabase Storage** over Cloudflare R2 (R2 requires a card on file even for
  its free tier; the user doesn't have one available). Uses Supabase's **S3-compatible API**, not
  its native JS client — `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
- `backend/src/lib/storage.ts`: `createUploadUrl({ contentType, folder })` → 5-minute presigned
  PUT URL + the resulting public URL. Env vars read **lazily** (not thrown at module load like
  `JWT_SECRET` is) — an incomplete storage config only breaks the upload route, not the whole
  server. Non-obvious gotcha now documented in D-021: Supabase's **public** object URLs live on
  a different hostname (`<ref>.supabase.co`) than the **S3-compatible** one used for signing
  (`<ref>.storage.supabase.co`) — `storage.ts` derives the project ref from the S3 endpoint to
  build the public URL.
- `backend/src/routes/uploads.ts`: `POST /api/uploads/sign { contentType, folder }` (auth
  required) — client uploads directly to the bucket with the returned URL, never through this
  backend.
- Credentials stored **only** in `backend/.env` (confirmed still gitignored, never committed) —
  user supplied the S3 endpoint + access key pair in chat; region (`ap-south-1`) and bucket
  (`uploads`) got filled in shortly after.
- **Verified thoroughly, including live network calls** (not just curl-against-localhost): signed
  a real upload, `PUT` a test file to it (200), fetched it back via a **signed GET** (200, bytes
  matched) — proves credentials/region/bucket are all correct. Public **unsigned** read currently
  404s ("Bucket not found") — diagnosed precisely to **the bucket's "Public" toggle being off** in
  the Supabase dashboard (a one-click fix on the user's end, not a code problem). Also ran the
  full donate flow end-to-end with a real uploaded `proofUrl` and confirmed it round-trips
  correctly through `POST .../contributions` → `GET .../contributions`.
- Mobile: `expo-image-picker` installed + added as an `app.json` config plugin (photo-library
  permission text) → `expo prebuild` re-run to sync native projects. `NeedDetailScreen`'s donate
  form now has an optional "Attach payment screenshot" step (pick → sign → upload → submit
  `proofUrl` alongside the UTR). `tsc --noEmit` clean; `expo export --platform ios` bundled clean
  (659 modules).

**Not done / caveat:** The bucket's public-read isn't confirmed working yet — waiting on the user
to flip "Public bucket" in the Supabase dashboard (Storage → `uploads` → Edit bucket). Everything
else in the pipeline (signing, upload, DB storage, retrieval via the API) is confirmed working.
QR-code upload for a `MONEY` need's `upi_qr` field is *not* wired into `CreateMoneyNeedScreen` —
only the donate-proof upload got built; typing a UPI ID still works without it. Web-panel doesn't
have image upload UI either (it only confirms/rejects contributions, doesn't donate). No
simulator/browser to see any of this render, same standing caveat as every prior session.

**Next:** Confirm the bucket is public (ask the user, or just re-test `curl` on a `publicUrl`),
then resume Milestone 3 (Kits, PRD §9 first) per TASKS.md's build order — or, per the user's
broader ask this session, push to GitHub + get the backend itself deployed (only its Postgres is
on Railway right now; the Express server isn't deployed anywhere, so the Vercel-hosted admin/
web-panel currently have nothing real to talk to except localhost).

---

### Session 12 — Wiring pass: admin console + web-panel Needs UI, mobile "My needs"
Not a TASKS.md milestone — a deliberate detour to close UI gaps flagged (but not fixed) in
Sessions 10–11: the backend supported need-verification and contribution-override, but only
mobile had UI for any of it. User had also independently deployed `admin` and `web-panel` to
Vercel (`donation-platform-rho-six.vercel.app` = admin; an "organizers" URL for web-panel, behind
Vercel's SSO protection so not previewable) — this session wires up what those deployments show.

**Done:**
- Backend: `GET /api/needs/mine` (owner's own needs, any status — registered before `GET /:id` to
  avoid Express route-order collision) and `GET /api/admin/needs?status=...` (was hardcoded to the
  `PENDING_VERIFICATION` queue; now defaults there but accepts any status or `ALL` for general
  oversight). Both curl-verified (isolation between users' `/mine`, 400 on a bogus status, correct
  filtering).
- **Admin**: new "Needs" tab (default tab now, ahead of "All users") — `NeedsPage.tsx` (status
  filter chips, verify/reject with a `window.prompt` reason per D-017) and `NeedDetailPage.tsx`
  (progress bar, contributions table with Confirm/Reject **restricted to `isAdmin`** in the JSX —
  Staff sees the table read-only, matching the backend's D-018 enforcement). Added `.btn`/
  `.btn-danger-outline`/`.chip`/status-badge CSS.
- **Web-panel**: `DashboardPage` now switches between `MyNeedsPage` (default — `GET /api/needs/mine`,
  since the public feed alone can't show a `PENDING_VERIFICATION` or `REJECTED` need),
  `CreateMoneyNeedPage`, and `NeedDetailPage` (confirm/reject as beneficiary — no admin-override
  concept needed here since the institution *is* the postedBy). Ported the same table/badge/button
  CSS as admin for consistency (D-014 shared design system — still hand-duplicated per app, same
  TODO-to-extract noted since Session 9).
- **Mobile**: added a "My needs" tab alongside the live feed (`MyNeedsScreen.tsx`,
  `GET /api/needs/mine`) — previously a poster had no way to see their own `DRAFT`/
  `PENDING_VERIFICATION`/`REJECTED` needs at all once they navigated away from the create screen.
- All three frontends: `tsc`/`vite build` (web-panel, admin) and `tsc --noEmit` + `expo export
  --platform ios` (mobile, 655 modules) all clean.

**Not done / caveat:** Still no browser/simulator to actually click through any of this — same
caveat as every prior session, now covering three more pages per surface. Didn't touch the actual
Vercel deployments (env vars, redeploys) — that's a separate action if the user wants these code
changes live on the URLs above. KYC (D-007), notifications, and the full admin console (settings,
analytics per PRD §15) are still untouched — only the Needs-specific slice was in scope here.

**Next:** Either resume Milestone 3 (Kits, PRD §9 first) per TASKS.md's build order, or — if the
user wants the Vercel deployments to reflect this session's work — push to GitHub and
redeploy/reconfigure admin + web-panel on Vercel (their `VITE_API_URL` needs to point at a real
deployed backend, not `localhost`; the backend itself isn't deployed anywhere yet, only its
Postgres is, on Railway).

---

### Session 11 — Milestone 2: Money needs (post → donate → confirm → progress bar)
**Done:**
- Wrote **PRD §7** (Money Need flow, v0.6): payload fields incl. a shared `Need.deadline` field
  (not per-type payload — the lifecycle engine needs to read it generically for auto-expiry),
  the donate step (UPI deep-link + UTR proof, D-009), confirmation + admin override (D-002/D-018),
  progress bar + auto-close/expiry/resubmit (D-013).
- `backend/prisma/schema.prisma`: added `Contribution` model (`kind`/`amount`/`status`/**unique
  `utr`** per D-019/`proofUrl`/`confirmedById`) and `Need.deadline`. Migrated against the same
  Railway DB from Session 10.
- `backend/src/lib/moneyNeed.ts` (payload validation/parsing) and `needExpiry.ts` (lazy
  deadline-expiry check — no cron/scheduler infra yet, so it runs on every read path instead).
- `backend/src/routes/needs.ts`: MONEY payload is normalized on create/edit — **client-supplied
  `raised_amount` is always stripped and forced to 0**, since it must only ever come from
  confirmed contributions, never client input. Submit is blocked (400) until `target_amount` +
  `upi_id` are set. Added donate (`POST /:id/contributions`, blocked once non-fundable —
  covers the FULFILLED-stops-accepting rule from D-013) and list-contributions routes, plus
  `POST /:id/resubmit` (EXPIRED → DRAFT) and `EXPIRED → DRAFT` added to the lifecycle transition
  table in `needLifecycle.ts`.
- `backend/src/routes/contributions.ts` (new, mounted at `/api/contributions`): confirm/reject.
  Confirm clamps `raised_amount` at `target_amount` (avoids >100% display) and advances the Need
  `LIVE → PARTIALLY_FULFILLED → FULFILLED` through `assertTransition`. `canDecide()` allows the
  need's beneficiary **or ADMIN** (override) — explicitly not STAFF, matching D-018's "cannot
  override confirmed donations."
- **Verified end-to-end against the live Railway DB with curl** (extensive — see TASKS.md for the
  full list): tamper-guard on `raised_amount`, submit-gating, UTR uniqueness (P2002 → 409),
  RBAC on confirm/reject (donor 403, staff 403, beneficiary/admin 200), overshoot clamping to
  exactly target (not over), FULFILLED need rejects further contributions, FULFILLED need drops
  out of the public feed, a past-deadline need lazily flips to EXPIRED on read, EXPIRED → resubmit
  → DRAFT → (edit deadline) → submit → verify works, contribution reject leaves `raised_amount`
  untouched.
- Mobile: `HomeScreen` now does simple local-state view-switching (feed/detail/create — no router
  yet, noted as a deliberate "revisit once it's needed" choice) between the existing feed,
  `NeedDetailScreen` (progress bar, `lib/upi.ts` UPI deep-link via `Linking.openURL`, UTR donate
  form, and — if you're the need's owner — a confirm/reject panel for pending contributions), and
  `CreateMoneyNeedScreen` (title/description/target/UPI, creates + auto-submits). `npx tsc
  --noEmit` clean; `npx expo export --platform ios` bundled clean (654 modules).

**Not done / caveat:** Same as Session 10 — no simulator/browser tool available, so mobile UI is
verified by typecheck + bundle export + the backend endpoints it calls (curl-tested thoroughly),
not an actual render. QR-code display and screenshot/proof-doc upload are **not built** — there's
no object-storage bucket/CDN pipeline yet (`backend/README.md` flags this as a cross-cutting TODO
shared by every flow that uploads images); UTR-as-text-proof works without it, so the core loop
isn't blocked. No admin-console UI for verify/reject/override — backend-only, same gap as Session
10, now also covering contribution confirm/reject.

**Next:** Milestone 3 — Kits (write PRD §9 first): kit definition (contents, cost/kit, kits
needed), money-per-kit vs buy-&-deliver modes, funded/needed progress + fulfilment confirmation.
Reuses the `Need`/`Contribution` engine from Milestones 1–2 with `KIT`-shaped payloads.

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
