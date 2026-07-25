# PROGRESS.md — Session Handoff

> The most important file for surviving credit limits. Update it **before every session ends**.
> A new session reads this to know exactly where things stand. Keep the latest entry at the top.

---

### Session 25 — Milestone 9 Chunk 5: Admin approval of institutions (admin)
This session implemented Chunk 5 - building the institution verification queue console and KYC status management (Approve / Reject-with-reason) in both the Backend and the Admin Console.

**What was done:**
1. **Backend Routing & Gating:**
   - Exposed `GET /api/admin/kyc/queue` to fetch institutions pending review (or matching status queries like `ALL/APPROVED/REJECTED`), sorted oldest first.
   - Exposed `POST /api/admin/users/:id/kyc` to approve or reject a user's KYC profile.
   - Enforced that both routes are gated to users carrying the `ADMIN` or `STAFF` roles.
   - Documented role division: both roles share user-verification/need-approval tasks, while staff is restricted from mutating staff logins, overriding transactions, or settings.

2. **Admin Console API & Types:**
   - Extended `AuthUser` and `AdminUser` interfaces in `admin/src/lib/api.ts` to match backend KYC fields.
   - Added `fetchKycQueue` and `updateKycStatus` client helpers.

3. **Admin Queue Dashboard Interface:**
   - Replaced the institutions placeholder screen `admin/src/pages/InstitutionsPage.tsx` with a split-pane dashboard.
   - Added filter tabs ("Pending Review", "Approved", "Rejected", "All") listing institutions in a search-friendly table.
   - Integrated a detail panel opening on selection, showing complete details (Legal name, Type, Reg number, Darpan ID, Address, Bank account, clickable certificate link, and photo image thumbnails).
   - Added **Approve** action, and **Reject** action showing inline input box enforcing a rejection reason.

4. **Build & Automated Verification:**
   - Wrote a typescript verification script testing all admin endpoints: queue fetching, role gating (non-admin 403 blocks), rejection validation (reject without reason blocks), rejection success, and approval success.
   - Verified that `backend`, `web-panel`, `admin`, and `mobile` compile cleanly without errors.

**Next:** Milestone 9 Chunk 6 — Duplicate-response fix + global error/validation handling, closing the concurrent responses/double-pledge gaps and adding shared error wrappers.

### Session 24 — Milestone 9 Chunk 4: Institution registration & KYC (web-panel)
This session implemented Chunk 4 - replacing direct OTP self-registration of institution accounts with a robust multi-step profile submission and document upload flow on the Web Panel, alongside implementing backend KYC gates and verification status screens.

**What was done:**
1. **Database Schema Enhancements:**
   - Added `InstitutionType` and `KycStatus` enums to `backend/prisma/schema.prisma`.
   - Added new KYC fields to the `User` model (`institutionType`, `legalName`, `registrationNumber`, `darpanId`, `address`, `bankAccount`, `kycDocumentUrl`, `kycPhotos`, `kycStatus`, `kycRejectionReason`).
   - Synced database schema updates to Railway PostgreSQL using `npx prisma db push`.

2. **Backend API Enhancements:**
   - Extended `updateMeSchema` validation and path logic in `PATCH /api/auth/me` to process and validate KYC inputs, requiring `darpanId` only for NGOs when submitting for approval (`kycStatus: "PENDING_APPROVAL"`).
   - Added `GET /api/auth/kyc` to allow institutions to retrieve their KYC verification status.
   - Gated need creation and submit endpoints (`POST /api/needs` and `POST /api/needs/:id/submit`) to return a **403 Forbidden** error if the poster is an institution and is not yet `APPROVED`.
   - Extended `/api/uploads/sign` to allow `application/pdf` contentType and organize uploads under a new `"kyc-docs"` folder.

3. **Web Panel Onboarding & Profile Sync:**
   - Extended `AuthUser` types and folder signatures in `web-panel/src/lib/api.ts`.
   - Added `refreshUser` inside `web-panel/src/context/AuthContext.tsx` to handle live user updates.
   - Implemented a multi-step registration workflow in `web-panel/src/pages/LoginPage.tsx` (Step 1: OTP, Step 2: Org profile inputs, Step 3: PDF certificate + photos upload using signed-URL flow) before logging in.
   - Refactored `web-panel/src/pages/VerificationStatusPage.tsx` to showcase real-time KYC status (Pending, Approved, Rejected) and details, enabling full editing and re-submission of rejected/unsubmitted KYC profiles.
   - Blocked the publish features in `web-panel/src/pages/PostNeedPage.tsx` for unapproved institution users.

4. **Build & Automated Verification:**
   - Wrote a typescript verification script confirming that unapproved institutions get blocked with `403` on need post, while approved ones successfully create drafts with `201`.
   - Verified that `backend`, `web-panel`, `admin`, and `mobile` compile cleanly without errors.

**Next:** Milestone 9 Chunk 5 — Admin approval of institutions (admin), implementing an approvals queue console for administrators/staff to approve or reject submitted institution registrations.

### Session 23 — Milestone 9 Chunk 3: Donor registration & profile (mobile)
This session implemented Chunk 3 - Donor registration & profile details on the mobile client. We added a full profile setup onboarding screen, updated the profile display tab, and integrated completeness gates for need posting and blood responses.

**What was done:**
1. **Backend Enhancements:**
   - Modified `backend/prisma/schema.prisma` to add an optional `email` field to the `User` model, and successfully synced the database via `npx prisma db push`.
   - Updated the `updateMeSchema` validation in `backend/src/routes/auth.ts` to support optional email inputs, verifying it compiles cleanly.

2. **Mobile Client - API & Navigation:**
   - Updated `AuthUser` interface in `mobile/src/lib/api.ts` to include `email`, `city`, and `area` fields.
   - Updated `updateMe` type definitions to accept the `email` field.
   - Declared `Register` screen in `RootStackParamList` in `mobile/src/navigation/types.ts`.
   - Configured `RootNavigator.tsx` stack with a conditional `initialRouteName` which routes users immediately to the `Register` onboarding step if their profile is incomplete.

3. **Mobile Client - Onboarding Form & Profile Tab:**
   - Implemented `isProfileComplete` helper in `mobile/src/lib/profile.ts` which asserts that Name, DOB, Gender, Blood group, City, and Area are non-empty.
   - Created the onboarding registration screen `mobile/src/screens/RegisterScreen.tsx` collecting Name, Email (optional), DOB (with YYYY-MM-DD validation), permanent City and Area, Gender, and Blood group (reusing custom Chip components for consistency with the design system).
   - Fully refactored `mobile/src/screens/ProfileScreen.tsx` to display all profile details, a live Switch toggle for `availableToDonate` availability, a button navigating to edit mode on the registration form, and a link routing to contributions history.

4. **Action Gating:**
   - Gated "Post a Need" (CreateNeedButton in `TabNavigator.tsx`) behind `isProfileComplete`. Tapping it while incomplete alerts the user and guides them to the registration screen.
   - Gated "I can donate" blood responses in `NeedDetailScreen.tsx` behind the same completeness check, preventing incomplete users from pledging blood.

5. **Build Verification:**
   - Verified that `npx tsc --noEmit` and `npx expo export` bundle cleanly for Android and iOS on `mobile` (1084 modules, 0 compilation issues).
   - Re-verified web-panel, admin, and backend builds remain fully green.

**Next:** Milestone 9 Chunk 4 — Institution registration & KYC (web-panel), replacing self-registration with a multi-step org profile + document upload verification flow.

### Session 22 — Milestone 9 Chunk 2: Navigation (Web-panel & Admin)
This session focused on Chunk 2 - routing and navigation. We migrated both the Web Panel and the Admin Console from state-switching to real path-based routing via `react-router-dom`, standing up a persistent sidebar layout for both.

**What was done:**
1. **Web-panel Routing:**
   - App is wrapped with `BrowserRouter` and routes are configured in `web-panel/src/App.tsx`.
   - Built a persistent left sidebar layout in `web-panel/src/components/DashboardLayout.tsx` matching Appendix A styles.
   - Added dashboard overview landing page `web-panel/src/pages/DashboardOverviewPage.tsx` displaying statistics of active/pending/completed needs.
   - Created need-type chooser page `web-panel/src/pages/PostNeedPage.tsx` and routed all five type creation screens to sub-routes.
   - Created `web-panel/src/pages/VerificationStatusPage.tsx` (KYC status placeholder) and `web-panel/src/pages/ProfilePage.tsx` (profile details with log out).
   - Created `web-panel/src/pages/NeedDetailRouteWrapper.tsx` to cleanly resolve `needId` params and render `NeedDetailPage`.
   - Cleaned up unused imports/variables causing compile errors in `MyNeedsPage.tsx` and `NeedDetailPage.tsx`.
   
2. **Admin Routing:**
   - Installed `react-router-dom` in `admin/package.json`.
   - Built a persistent left sidebar layout in `admin/src/components/ConsoleLayout.tsx`.
   - Configured path-based routes in `admin/src/App.tsx` matching sidebar options.
   - Configured `AdminRoute` wrapper to restrict Admin-only routes (`/post` and `/staff`) client-side.
   - Created `admin/src/pages/InstitutionsPage.tsx` as a placeholder KYC approval queue (Chunk 5).
   - Created `admin/src/pages/NeedDetailRouteWrapper.tsx` to cleanly resolve parameters.
   - Updated `admin/src/pages/NeedsPage.tsx` table click actions to route via router navigation instead of props callback.
   
3. **Styles & Build Verification:**
   - Added flex-based persistent sidebar CSS layout rules at the bottom of both `web-panel/src/index.css` and `admin/src/index.css`.
   - Swapped out some props on pages (like `onClick` for `onPress` on Button, wrapping `Card` to avoid style conflicts) to pass TypeScript type-checking.
   - Verified web-panel builds successfully (`tsc -b && vite build` clean).
   - Verified admin builds successfully (`tsc -b && vite build` clean).
   - Verified mobile compiles and bundles cleanly (`tsc --noEmit` and `expo export` clean).
   - Verified backend compiles cleanly (`tsc` clean).

**Next:** Milestone 9 Chunk 3 — Donor registration & profile (mobile), introducing the post-OTP registration step and Profile tab gating.

### Session 21 — Milestone 9 Chunk 1: Design-system foundation (all three frontends)
User handed over a full, user-authored Milestone 9 spec ("Professional UX, Registration &
Hardening") with 7 chunks and an explicit instruction: work them **one chunk per session**, build
green + update TASKS.md/PROGRESS.md after each, don't start a chunk that can't finish. This
session was Chunk 1 only — everything else (navigation, registration/KYC, the duplicate-response
bug, visual polish) is still ahead, in that order. Milestone 8 (Community layer) remains
un-started; the user's new spec took priority over the natural Milestone 8→9 sequence, which is
their call to make.

**Context loaded first, as instructed:** CLAUDE.md, PRD Appendix A + §6, D-007/008/010/014,
TASKS.md, PROGRESS.md, DECISIONS.md.

**What Chunk 1 actually was:** extract each app's duplicated/drifted theme into a complete token
set matching Appendix A, and stand up a real shared component kit — foundational, since every
later chunk (registration forms, KYC screens, the visual-polish pass) will build on it.

**Real bug found, not hypothetical:** admin's `lib/theme.ts` was missing `success`/`warning`/
`info` and the entire spacing scale — it had silently drifted from mobile's and web-panel's
theme files, which both had the full set. Fixed by rewriting it to match exactly.

**Typography (A.2) — a deliberate scope split:** web-panel and admin now load Noto Sans (Latin +
Devanagari + Telugu subsets) via a Google Fonts `@import` in `index.css` — free to add since
browsers only fetch the glyph subsets a page actually renders, so this costs nothing today and
means D-009's tri-language work can start using the font stack immediately with no follow-up
CSS change. Mobile is different: React Native doesn't get that automatic per-glyph fallback, real
multi-script loading means shipping actual font files + `expo-font` + a `useFonts` gate, and
**there is zero non-English text anywhere in the app** (no i18n framework has been started at
all despite D-009 being "committed for v1"). Shipping that dependency now, with nothing to
render against it and no way to visually verify it in this environment, would be exactly the
kind of premature work CLAUDE.md's guidelines warn against. Defined the typography *scale*
(display/h1/h2/body/caption × weights/line-heights) for real — that's what every screen should
build against today — and left the font *family* on system default with an explicit inline note
tying the swap to the actual i18n milestone, not silently forgotten.

**Shared UI kit** — `components/ui/` in all three apps, same 10 pieces everywhere (Button, Badge,
Chip, Card, Input, Avatar, EmptyState, ErrorState, Skeleton, Toast+Provider):
- Mobile: real React Native components built against the extended `theme.ts` (StyleSheet-based,
  same convention every existing component already used).
- Web-panel/admin: thin components wrapping the **existing global CSS classes** (`.btn`,
  `.badge`, `.chip`, etc.) rather than introducing CSS-in-JS — consistent with how every page in
  both apps is already styled, and both apps are structurally identical Vite+React+plain-CSS
  builds with no shared-package tooling, so the two app's kit files are legitimately
  near-identical copies (same pattern already established for e.g. `CreateBloodNeedPage.tsx`
  across web-panel/admin all through this build). Added the CSS this needed: `.card`,
  `.badge-tone-*`, `.field-error`, `.empty-state`/`.error-state`, `.skeleton` (pulse keyframe),
  `.toast`, `.avatar`, plus a `.btn-secondary-outline` variant neither app had yet.
- `ToastProvider` mounted at all three app roots (`App.tsx`), ready for Chunk 6's "toast for
  success" requirement.

**Trivial refactor (as instructed — not a full migration):** swapped LoginScreen's (mobile) and
both LoginPage's (web-panel, admin) submit buttons over to the new `Button` component. Caught one
real subtlety while doing it: `Button` hardcodes `type="button"` by default (correct for
non-form buttons), but the web login forms need `type="submit"` for Enter-key-to-submit
accessibility — verified the component's prop spread order (`{...rest}` after the default)
already lets a caller override it, so `<Button type="submit" .../>` works without changing the
component. Also verified by hand that the existing `form button[type="submit"]` CSS rule still
wins on specificity over the new `.btn` class for every overlapping property, so the login pages'
visual appearance is unchanged, not just functionally equivalent — couldn't visually confirm in
a browser (no way to render one here), so this was reasoned through CSS specificity rules instead
of assumed.

**Verified:** `tsc -b` + `vite build` clean on web-panel and admin; `tsc --noEmit` + `expo export`
clean on mobile (752 modules, no bundler errors from the new files). Backend untouched — Chunk 1
is pure frontend work per its own scope, and the guardrail says don't touch tested backend
behavior without a chunk actually needing it; confirmed the dev server was still healthy
regardless. `.env` untracked (unaffected, not re-checked this session since nothing near it
changed, but no reason to expect drift).

**Not done (correctly, per the milestone's own chunking):** no navigation changes, no refactoring
beyond the two trivial login-button swaps, no registration/KYC work, no duplicate-response fix,
no visual-polish pass. All of that is explicitly later chunks.

**Next:** Milestone 9 Chunk 2 — Navigation (React Navigation on mobile, `react-router-dom` +
sidebar on web-panel and admin), per the milestone spec's own ordering ("everything depends on"
Chunk 1 being done first, which it now is).

---

### Session 20 — Milestone 7: Trust tiers & certificates (backend + mobile + admin)
User said "continue" after Session 19 wrapped Goods. Per TASKS.md/CLAUDE.md workflow, next up was
Milestone 7 — and it's the first milestone that's purely additive across types rather than a new
`Need` type: it reads *existing* confirmed-contribution history (across all five types built so
far) rather than adding anything to the Need/Contribution lifecycle itself.

**PRD:** Wrote §14 (out of numeric order ahead of §12/§13, same precedent as §9 before §8 —
noted in the changelog). Two deliberate "don't over-build" calls: tiers are **computed, never
stored** (same principle as raised_amount/kits_funded/etc.), and certificates are a **derived
view over a confirmed Contribution, not a stored record** — no new table for either. This also
closed the "later milestone" placeholder that's been sitting in a code comment since Money
(`needs.ts`: "a donor sees their own contributions via a 'my contributions' endpoint, which is a
later milestone") — this was that milestone.

**Backend:**
- `trustTier.ts` — pure function, thresholds (Bronze 0-4 / Silver 5-14 / Gold 15+) isolated so
  product can tune them without touching the schema or any call site. Confirmed-contribution
  count spans all five contribution kinds combined, not per-type.
- `contributionSummary.ts` — a kind-aware, human-readable summary generator ("₹5,000", "3 kits",
  "1 unit of blood", "a meal slot (₹500) on 2026-08-01", "a claimed item") plus the exact D-006
  disclaimer text as one constant, so the wording can't drift between call sites.
- `GET /api/contributions/mine` — every contribution the caller made, across every need, with
  need title/type included. The first contributions query from the donor's side; every prior one
  only worked for the need's owner or admin/staff.
- `GET /api/contributions/:id/certificate` — 403 unless caller is that contribution's donor or
  admin/staff; 409 if not yet `CONFIRMED`. Response is assembled fresh from the Contribution +
  Need + donor on every call.
- `trustTier`/`confirmedContributionsCount` added to `/auth/me`, `/auth/otp/verify`, and (via a
  filtered `_count` on the `contributionsMade` relation, not an extra round-trip) admin's
  `GET /api/admin/users`.
- Curl-tested end-to-end: a donor with one prior confirmed BLOOD contribution correctly shows
  `BRONZE`/`1`; `GET /mine` returns it with need context; certificate fetch succeeds for the
  donor, 403s for an unrelated account, and 409s against a freshly-created pending (unconfirmed)
  contribution; admin's user list shows the same computed tier.

**Mobile:** trust tier badge under the greeting on `HomeScreen`; new **"My contributions"** tab
(third tab alongside Live needs / My needs) via `MyContributionsScreen` — kind-aware summaries
reused from the same logic pattern as `NeedDetailScreen`'s, confirmed ones link to a certificate;
new `CertificateScreen` renders it as an actual certificate-styled card, with the D-006 disclaimer
given equal visual weight to the rest of the content (not fine print) — the whole point is never
letting it read as an official document.

**Admin:** `UsersPage` gained a Trust tier column (tier + confirmed count), reusing the same
backend computation.

**Deliberately not wired:** web-panel. Institutions aren't really the "earns a tier, views
certificates" persona this milestone targets — donors are — and nothing in scope needed it.
Documented as a scope decision in TASKS.md rather than silently skipped, same treatment as every
other deliberate omission this build.

**Verified:** `tsc -b`/`vite build` clean on web-panel (untouched, confirmed still fine) and
admin; `tsc --noEmit` clean + `expo export` clean on mobile; backend `tsc` clean throughout. Two
more transient Railway blips in the dev log during testing, both caught cleanly by the existing
crash-resilience middleware — not regressions, consistent with every prior session's experience
with this Railway proxy. `.env` confirmed untracked. TASKS.md Milestone 7 checkboxes updated.

**Next:** Milestone 8 — Community layer (Q&A forum + Volunteering, PRD §12–13 first), per
TASKS.md — the last of the per-type milestones before the cross-cutting work (admin console
polish, institution KYC, notifications, security pass) that TASKS.md has been accumulating
partial-progress notes on throughout.

---

### Session 19 — Milestone 6: Goods / unused-items flow (backend + all three frontends)
User said "continue" after Session 18 wrapped Meal-slot. Per TASKS.md/CLAUDE.md workflow, next up
was Milestone 6 — and the notable thing about this one is it needed **no custom module at all**.
CLAUDE.md §3 only calls out Blood and Meal-slot as breaking the shared pattern; Goods rides the
same `Need`/`Contribution` engine as Money/Kit, just with a fulfilment target of 1.

**PRD:** Wrote §11. Key design call: a GOODS need is the beneficiary posting "I need X" (same
direction as every other type), a donor **claims** it (a pledge, same principle as Blood's
respond and Kit's `DELIVER` mode — never a payment), and on confirm the need jumps straight
`LIVE → FULFILLED` — there's no `PARTIALLY_FULFILLED` for "1 item, 1 claim." Deliberately **no
claim-locking**: unlike Meal-slot's calendar (many fast-moving dates, D-022), this is one
low-frequency manual action — multiple donors can submit competing pending claims and the
beneficiary just picks one to confirm, same "over-committed pending contributions aren't
auto-rejected" tolerance Money/Kit already carry.

**Backend:**
- `goodsNeed.ts` — payload schema (`item`, `condition`, server-computed-only `claimed`, same
  tamper-guard principle as every other progress field).
- Reused the **existing** generic `POST /:id/contributions` dispatcher for the claim (no
  dedicated route needed, unlike Meal-slot's booking endpoint) — a claim is just
  `{kind: GOODS}` with no amount/kits/units/utr at all, dispatched the same way Blood's
  `{units}` pledge already is.
- `computeFulfilment`'s GOODS branch is a one-shot: no clamping/partial math like every other
  type, just straight to `FULFILLED` on first confirm.
- Added `ContributionKind.GOODS` to the schema (small migration).
- Curl-tested the full loop end-to-end: post → submit → admin-verify → LIVE → donor claims
  (PENDING_CONFIRMATION) → beneficiary confirms → need jumps straight to FULFILLED with
  `claimed: true`; then verified the edge cases that actually mattered for this design — a
  FULFILLED need correctly 409s on a further claim attempt, and on a second need, rejecting a
  claim correctly leaves the need `LIVE` with `claimed` still `false` (item stays open, matching
  the "no locking, beneficiary manages competing claims manually" decision).

**Mobile:** `CreateGoodsNeedScreen` (title/description/item/condition/photos — simplest create
form yet, no mode toggle, no dates); `NeedCard` shows item + condition instead of a progress bar
(nothing meaningful to bar-chart for a boolean); `NeedDetailScreen` gained a "Claim this item"
section mirroring Blood's respond UI almost exactly (pledge framing, consent-via-claiming
language), plus a kind-aware `formatContributionAmount` branch (GOODS just shows "Claim").

**Web-panel & Admin:** `CreateGoodsNeedPage` on both (web-panel auto-links the posting
institution for fast-track self-verify, same as Blood/Meal-slot; Admin's version doesn't, same
established reasoning as its other Create*Page siblings); `NeedsPage`/`NeedDetailPage` on both
show claimed/not-claimed status and kind-aware contribution formatting. Claiming itself is
mobile-only (donors are the mobile side), same division as Meal-slot booking.

**Verified:** `tsc -b`/`vite build` clean on web-panel and admin; `tsc --noEmit` clean + `expo
export` clean on mobile; backend `tsc` clean throughout. Two more transient Railway
`PrismaClientInitializationError`/`Can't reach database server` blips showed up in the dev log
during this session's testing — both caught cleanly by the `express-async-errors` fix from
Session 17 (logged, server kept running, next request succeeded normally) — consistent with the
known Railway proxy flakiness, not a regression. `.env` confirmed untracked. TASKS.md Milestone 6
checkboxes updated.

**Not done:** nothing deliberately deferred this time — §11's scope (post/claim/confirm, no
locking, no progress bar) was intentionally minimal from the PRD stage, and everything in it got
built.

**Next:** Milestone 7 — Trust tiers & certificates (PRD §14 first), per TASKS.md. Note: both
Blood's (§8) and Goods' (§11) "post-donation certificate" deferrals point here — this milestone
should cover confirmed-contribution certificates generically across every type, not just one.

---

### Session 18 — Milestone 5: Meal-slot booking (backend + all three frontends)
User said "continue" after Session 17 wrapped Blood. Per TASKS.md/CLAUDE.md workflow, next up was
Milestone 5 — the *other* genuinely custom module (CLAUDE.md §3): a `MEAL_SLOT` need must
guarantee no two donors ever book the same calendar date.

**PRD:** Wrote §10 (payload fields, the new `MealSlot` child entity, the locking mechanism,
confirmation/fulfilment incl. the reject-reopens-the-date rule, progress display) and a new
decision, **D-022**, documenting the locking approach and why it's safe without an explicit
`SELECT ... FOR UPDATE` or distributed lock.

**Backend:**
- Schema: `MealSlot` model (`needId`, `date`, `status: OPEN|BOOKED|CONFIRMED`, `contributionId`)
  with a `(needId, date)` unique constraint; `ContributionKind.MEAL_SLOT`; `Contribution.
  mealSlotDate` — added as a **second** migration mid-session after realizing the first design
  (relying solely on `MealSlot.contributionId`) would silently lose a rejected contribution's
  date once that slot got rebooked by someone else and the pointer got overwritten; storing the
  date redundantly on the Contribution itself avoided that.
- `mealSlotNeed.ts` — payload schema/parser, plus `dedupeDates()` (collapses same-calendar-day
  duplicates before they'd otherwise hit the DB unique constraint).
- Need creation for MEAL_SLOT is a dedicated code path (`createMealSlotNeed`), not the generic
  `normalizePayload` + single `create` every other type uses — it needs a transaction that
  creates the Need **and** one `MealSlot` row per date atomically. Same special-cased transaction
  on `PATCH` while still DRAFT (wholesale-replaces the date list — safe because nothing can be
  `BOOKED` pre-LIVE).
- **The locking itself (D-022):** `POST /api/needs/:id/meal-slots/:slotId/book` creates the
  Contribution and runs `UPDATE "MealSlot" SET status='BOOKED' WHERE id=:slotId AND
  status='OPEN'` in the same transaction; if the update affects 0 rows (someone else's request
  won the race), the handler throws and the whole transaction — Contribution included — rolls
  back, returning a clean 409. No `SELECT ... FOR UPDATE`, no app-level lock, no `SERIALIZABLE`
  isolation — Postgres's own row-update semantics are the lock.
- Confirm advances `slots_confirmed` (only on confirm, same audit principle as every other
  progress field) and flips the `MealSlot` to `CONFIRMED`. **Reject reopens the date** (`BOOKED
  → OPEN`, `contributionId` cleared) — the one place this type's confirm/reject differs from
  Money/Kit/Blood, because a rejected contribution there just doesn't count, but here rejection
  must also free the calendar date or one bad payment claim would permanently block it.
- **Verified the locking is actually correct, not just designed correctly:** fired two donor
  accounts' booking requests at the exact same slot **concurrently** (backgrounded curl + `wait`)
  — exactly one succeeded, the other got the 409. Then confirmed the winner (need went
  `PARTIALLY_FULFILLED`, `slots_confirmed: 1`), booked a second date, **rejected** it, confirmed
  the slot reopened to `OPEN`, and immediately rebooked it with a different donor to prove the
  reopened date was genuinely available again — not just marked open but actually bookable.

**Mobile:** `CreateMealSlotNeedScreen` (plain `YYYY-MM-DD` text entry + chip list for dates — no
date-picker dependency added, consistent with this app's "don't add a dependency until it's
needed" pattern already applied to routing); `NeedDetailScreen` gained a date-chip calendar
(open/taken/selected) with UPI-or-pledge booking depending on mode, and handles the 409
gracefully by refetching so the donor sees the date is gone and can pick another instead of
staring at a raw error. `NeedCard` shows aggregate slot progress.

**Web-panel & Admin:** `CreateMealSlotNeedPage` on both (web-panel auto-links the posting
institution for fast-track self-verify, same as Blood; Admin's version omits that, same as its
Blood page, since an admin posting on someone's behalf isn't the one who'd self-verify).
`NeedDetailPage` on both shows aggregate progress plus every date's live status as badges — donors
only book from mobile, so these two just needed visibility + the existing confirm/reject flow to
become kind-aware for MEAL_SLOT amounts (date + ₹ or just date for a DELIVER-mode pledge).

**Verified:** `tsc -b`/`vite build` clean on web-panel and admin; `tsc --noEmit` clean + `expo
export` clean on mobile; backend `tsc` clean throughout, dev server auto-reloaded through every
change without crashing. One transient Railway `PrismaClientInitializationError` showed up in the
dev log during testing — caught cleanly by Session 17's `express-async-errors` fix (logged as
`[unhandled]`, server kept running), not a regression. `.env` confirmed untracked.

**Not done:** `capacity` (multiple bookings per date) — v1 is one booking per date, matching what
was actually decided in D-022/PRD §10.2; a recurring-schedule generator for dates (institution
enters each date individually, capped at 60) — deferred, not asked for. TASKS.md Milestone 5
checkboxes updated to match.

**Next:** Milestone 6 — Goods / unused-items flow (PRD §11 first), per TASKS.md.

---

### Session 17 — Milestone 4: Blood module (backend + all three frontends)
User asked for full kickoff of Milestone 4 per TASKS.md: PRD §8 first, then backend, then wire
all three frontends. Also folded in a mid-session ask ("admin can also post require kits...
blood like this also") by making sure Admin's posting UI covers Blood too, not just Money/Kit.

**PRD:** Wrote §8 (donor blood profile, eligibility computation, BLOOD Need payload/urgency/
linked-institution reuse, matching+notifications, respond→connect→confirm, privacy). Caught and
fixed my own wording bug before implementing: first draft said institution+admin verification
were both required, which contradicts D-008's actual fast-track intent (either alone is
sufficient) — corrected in the PRD before writing code against it.

**Backend (full Blood module):**
- Schema: `BloodGroup`/`Gender` enums, User blood fields (`bloodGroup`, `dateOfBirth`, `gender`,
  `lastDonationDate`, `availableToDonate`, `expoPushToken`), `Contribution.units`,
  `ContributionKind.BLOOD`.
- `bloodEligibility.ts` (age 18–65, 90/120-day gap rules), `bloodNeed.ts` (payload schema),
  `pushNotifications.ts` (Expo push, best-effort/non-blocking), `bloodMatching.ts` (coarse DB
  query + eligibility filter + push, triggered on institution/admin verify and EMERGENCY
  escalation).
- New endpoints: `PATCH /api/auth/me` (profile self-edit, deliberately excludes
  `lastDonationDate` — anti-gaming), `POST /api/needs/:id/institution-verify` (D-008 fast-track),
  `POST /api/needs/:id/urgency` (closed a real gap — **no endpoint existed anywhere** to set
  urgency, so every need was permanently stuck at NORMAL despite D-012 correctly blocking
  self-declaration in create/update).
- Two robustness fixes found while testing, not requested but real: (1) `/otp/verify` returned
  only 4 hand-picked fields while `/me` returned the full user — meant `bloodGroup` etc. were
  `undefined` right after login despite being typed as nullable-not-undefined; made both return
  the full user object. (2) A dropped DB connection during a request crashed the **entire**
  process, not just that request, because Express 4 doesn't catch async handler rejections —
  added `express-async-errors` + a global error middleware.
- Infra fix: `prisma migrate dev` was reliably failing with P1001 against Railway's proxy
  specifically during **shadow-database creation** (isolated by comparing `migrate status`,
  which doesn't need a shadow DB and always worked, against `migrate dev`, which always failed).
  Fixed by pointing `shadowDatabaseUrl` at a local Postgres db — now permanent architecture,
  documented in `schema.prisma` and `.env.example`.
- Curl-tested the full loop end-to-end after all frontend wiring was done too (not just once
  early): donor profile → institution posts+self-verifies BLOOD need (fast-track, LIVE) → donor
  responds (units) → institution confirms → need reaches `PARTIALLY_FULFILLED` with correct
  `units_fulfilled` → donor's `lastDonationDate` resets transactionally on confirm.

**Mobile:** `BloodProfileScreen`, `CreateBloodNeedScreen` (blood-group chips deliberately use
`theme.color.primary`, not `danger` — caught myself reusing red for a plain selection state,
which violates PRD Appendix A's "red reserved for urgency/emergency only" rule), respond flow in
`NeedDetailScreen` (shows `bloodEligibility` reasons if the donor isn't eligible), Expo push
registration wired into `HomeScreen`. Fixed a real display bug along the way: the old amount
ternary in `NeedDetailScreen` only handled KIT vs MONEY, so a BLOOD contribution would've
rendered "₹undefined" — added a proper kind-aware formatter.

**Web-panel:** `CreateBloodNeedPage.tsx` (auto-links the posting institution as
`linkedInstitutionId`, since it's the natural fast-track-verify candidate), institution-verify
button in `NeedDetailPage.tsx` (shown only when the logged-in institution's id matches
`linkedInstitutionId` and the need is still `PENDING_VERIFICATION`), blood progress display,
same kind-aware contribution-amount fix as mobile applied here too.

**Admin:** blood-aware `NeedsPage`/`NeedDetailPage` (progress column, kind-aware contribution
amounts), a new urgency control on `NeedDetailPage` (admin/staff can set NORMAL/URGENT/EMERGENCY
on any non-terminal need — this is the UI for the urgency-gap fix above), and Blood added as a
third option in `PostNeedPage`/`CreateBloodNeedPage` per the user's explicit "blood like this
also" — admin-posted blood needs don't set `linkedInstitutionId` (that's only meaningful for an
institution's own self-verify fast-track, doesn't apply to an admin posting on someone's behalf).

**Verified:** `tsc -b`/`vite build` clean on both web-panel and admin; `tsc --noEmit` clean +
`expo export` clean on mobile; backend `tsc` clean; full end-to-end curl smoke test (above)
re-run fresh *after* all frontend changes to confirm nothing broke. `.env` confirmed untracked
in git (standing check, done every session).

**Not done:** post-donation certificates (Milestone 7's job, not blood-specific) and a proper
consent gate before sharing donor contact details with a beneficiary (today it's the same
"confirm reveals donor info" behavior as every other contribution kind — flagged in TASKS.md,
not built, wasn't asked for this session). TASKS.md Milestone 4 checkboxes updated to match.

**Next:** Milestone 5 — Meal-slot booking (PRD §10 first), per TASKS.md, unless the user directs
otherwise.

---

### Session 16 — Admin "Post a need" (money + kit + photos)
Direct follow-on from Session 15's finding: "admin can technically post via the API but there's
no UI for it — flagged, not built." User explicitly asked for that UI this session.

**Done:**
- **Verified first, built second**: before touching the UI, curl-confirmed an admin-posted KIT
  need submits, **self-verifies** (same admin verifying their own posting — no restriction
  against that), goes `LIVE` with `postedBy.role: ADMIN`, appears in the exact public-feed query
  mobile uses, and accepts a real donor contribution — the whole loop, not just "the POST call
  succeeds" (which was as far as Session 15's check went).
- Admin gained the same object-storage client + `postMoneyNeed`/`postKitNeed` + `PhotoPicker`
  web-panel already had (copied/adapted, same pattern).
- New **`PostNeedPage`** (chooser → `CreateMoneyNeedPage`/`CreateKitNeedPage`, both new to admin,
  near-identical to web-panel's) wired as a new **"Post a need" tab** in `App.tsx`.
- **Deliberate scoping decision**: restricted the tab to `ADMIN`, not `ADMIN`+`STAFF` — D-018
  already draws a clean line (Staff = verify/accept + list users only), and posting on behalf of
  someone is a new capability, not a variant of an existing Staff one, so it stays on the Admin
  side of that line. The backend itself enforces nothing here (`POST /api/needs` has no role
  check at all) — confirmed with a direct curl call using a Staff token, which succeeded (201).
  This is a **UI-layer** scoping choice, documented as such in both `admin/README.md` and the
  code comment, not a backend restriction that was added.
- Full UI-flow simulation via curl (sign → upload → create-with-photo → submit → appears in
  queue → verify): all steps matched what the new `CreateMoneyNeedPage` component actually calls.
- `tsc -b`/`vite build` clean (27 modules, up from 23 at the start of Session 15).

**Not done / caveat:** No simulator/browser to see the actual tab render — same standing caveat.
The "self-verification" pattern (admin verifying their own posting) works but has no UI nudge or
warning about it — not asked for, not added. Blood (Milestone 4) will reuse this exact same
"admin can post on behalf of" mechanism for free once it's built, since it rides the same
`POST /api/needs` endpoint — no extra work needed there when that milestone starts.

**Next:** Milestone 4 — Blood module (PRD §8 first, still not written) per TASKS.md, unless
further UI-parity gaps keep surfacing (has been the dominant thread for three sessions running).

---

### Session 15 — Verification pass + two gaps closed: need-creation photos, web-panel kit parity
Not a TASKS.md milestone — the user asked me to verify a batch of claims about how fully wired
Kits actually were. Rather than guess, verified each one directly (curl + fresh test accounts),
found two real gaps, and closed both (user picked "both, photo upload first" when asked to
prioritize).

**Verification findings (all confirmed via live curl tests, not assumed):**
- Title/description: already present for every need type (shared `Need` fields) — no gap.
- **Gap found:** no way to attach a photo of the kit/situation **at need-creation time** — the
  `Need` object had no image field at all (checked the raw API response), only
  `Contribution.proofUrl` existed (donation-time proof).
- Admin *can* technically post a need via the API (no role check on `POST /api/needs`) — not by
  design (admin verifies, doesn't post, per PRD §4), but not blocked either. Flagged, not changed
  — an admin-console "post a need" UI was never asked for or built.
- Institution → admin → live-in-feed: confirmed working end-to-end (already true before this
  session, re-verified with a fresh INSTITUTION account posting a KIT need).
- **Gap found:** web-panel had no kit-**posting** UI at all — only `CreateMoneyNeedPage`. An
  orphanage/NGO could only post MONEY needs from their own panel; KIT needs required hitting the
  API directly (or using the mobile app under a `USER` account, which isn't really their role).

**Done (closing both gaps):**
- **`Need.photos String[] @default([])`** — new Prisma field, shared across every type (not
  per-type payload), migrated against the Railway DB. `POST`/`PATCH /api/needs` accept
  `photos: string[]` (capped at 5 server-side via Zod). This is literally the `proof_documents[]`
  field sketched in PRD v0.1 and never built — realized now, scoped to images.
- Added a third upload folder, `"need-photos"` (alongside `"contribution-proofs"`/`"need-qr"`),
  to `POST /api/uploads/sign`.
- **Mobile**: new `PhotoPicker` component (`expo-image-picker`, multi-select up to 5, thumbnail
  grid with remove) wired into both `CreateMoneyNeedScreen` and `CreateKitNeedScreen`; a new
  `uploadPhotos()` helper in `lib/api.ts` signs+uploads each file sequentially. Also installed
  **`expo-image`** (CLAUDE.md's performance rules called for it since Session 9 — never actually
  used until now) for `NeedCard`'s cover photo and `NeedDetailScreen`'s photo gallery, both with
  disk+memory caching. Re-ran `expo prebuild` twice (once for `expo-image-picker`'s permission
  plugin back in Session 13, once now for `expo-image`).
- **Web-panel**: built out the full object-storage client (`signUpload`/`uploadToSignedUrl`/
  `uploadPhotos`) it never had, a matching `PhotoPicker` component (HTML file input + thumbnail
  grid), and — the actual parity gap — `CreateKitNeedPage.tsx`, mirroring mobile's kit form
  (contents/cost/kits-needed/mode picker/conditional UPI field) plus photos. `DashboardPage`/
  `MyNeedsPage` now offer "+ Money need" and "+ Kit need" separately.
- Photo galleries added to `NeedDetailPage` in both admin and web-panel (`.photo-gallery` CSS,
  same pattern in both `index.css`s).
- **Verified the entire closed loop live, in one continuous curl script**: institution uploads a
  kit photo → posts a `KIT` need (deliver-mode) with that photo attached → submits → the photo is
  visible to admin in the verification queue *before* verification → admin verifies → the need
  (with photo, correct `postedBy.role: INSTITUTION`) appears in `GET /api/needs`, the exact
  endpoint mobile's feed queries → the photo URL is publicly fetchable with correct bytes.
- All three frontends: `tsc`/`vite build` (web-panel: 25 modules now, up from 23; admin) and
  `tsc --noEmit` + `expo export --platform ios` (mobile, up to 672 modules across two exports)
  all clean.

**Not done / caveat:** Admin console still has no "post a need" UI (confirmed the backend would
technically allow it, but this wasn't asked for and isn't the intended workflow — flagged as a
finding, not built). KYC-document upload (as opposed to situational photos) still isn't wired —
`photos[]` is scoped to images per PRD v0.8's changelog note; PDF/ID docs for institution KYC
(D-007) would reuse the same signed-URL mechanism but aren't built. No simulator/browser to
visually confirm any of this renders correctly — same standing caveat as every session since
Milestone 0, now covering photo thumbnails/galleries specifically too.

**Next:** Resume Milestone 4 (Blood module, PRD §8 first) per TASKS.md — or continue closing
UI-parity/polish gaps across surfaces if the user keeps finding them, which has been the more
active thread the last two sessions.

---

### Session 14 — Milestone 3: Kits (both funding modes)
**Done:**
- Wrote **PRD §9** (Kit flow): payload fields, both modes (D-004), confirmation/fulfilment
  reusing the Money pattern, progress display. Later added a `upi_id` field mid-build (see
  below) — v0.7 changelog covers it as part of the same section.
- `backend/prisma/schema.prisma`: `Contribution.amount`/`.utr` are now **nullable** (a
  DELIVER-mode kit pledge has neither — no payment happens), added `.kits Int?`, and
  `ContributionKind` gained `KIT` alongside `MONEY`. `utr` stays `@unique` — Postgres allows
  multiple NULLs while still enforcing uniqueness on the ones that exist, so D-019 holds yfor both
  types without a workaround. Migrated against the same Railway DB as every prior session.
- `backend/src/lib/kitNeed.ts`: KIT payload validation. **Caught and fixed a real gap while
  writing the mobile UI**, not before — a money-per-kit need needs a `upi_id` for donors to
  actually pay, exactly like a MONEY need's `upi_id`, and the initial payload schema didn't have
  one. Added it as required-when-`mode:MONEY` via a Zod `.refine()`, updated PRD §9.1's table,
  and re-verified the submit-gating end-to-end.
- `backend/src/routes/needs.ts`: `normalizePayload` extended to strip client-supplied
  `kits_funded` (mirrors the `raised_amount` tamper-guard); donate route now branches per
  `need.type` — MONEY keeps its existing shape, KIT requires `utr` when `mode:MONEY` and
  **rejects** a `utr` when `mode:DELIVER` (400 either way if violated).
- `backend/src/routes/contributions.ts`: confirm handler refactored into a shared
  `computeFulfilment()` that branches on `need.type` — same clamp-at-target +
  `LIVE→PARTIALLY_FULFILLED→FULFILLED` logic as Money, just against `kits_funded`/`kits_needed`
  instead of `raised_amount`/`target_amount`.
- **Verified extensively against the live Railway DB with curl**: money-mode kit flow
  (submit-gating incl. the upi_id fix, tamper-guard on `kits_funded`, donate without UTR → 400,
  confirm/RBAC, overshoot clamps to exactly `kits_needed`, FULFILLED lockout, UTR uniqueness);
  deliver-mode flow (sending a UTR → 400, pledge without one succeeds with `amount`/`utr` both
  null, confirm advances `kits_funded`, reject leaves it untouched); `?type=KIT` feed filter.
- Mobile: `CreateKitNeedScreen` (contents/cost/kits-needed/mode picker, conditional UPI field),
  `NeedCard`/`ProgressBar` generalized to show kit progress (`ProgressBar` gained an optional
  `label` override), `NeedDetailScreen` got a full second donate section for kits (mode-aware:
  UPI+UTR form for money-mode, a no-payment pledge form for deliver-mode, both with optional
  photo attachment via the same signed-upload flow from Session 13). `HomeScreen`'s single
  "Post a money need" button became two ("+ Money need" / "+ Kit need").
- **Caught and fixed a real latent bug in admin + web-panel before it shipped**: both apps'
  `Contribution` type still declared `amount`/`utr` as always-present strings/numbers; once KIT
  contributions could have them `null`, `NeedDetailPage`'s `c.amount.toLocaleString()` would have
  thrown at runtime the first time anyone viewed a kit need's contributions there. Fixed both
  apps' types (nullable + `kind`/`kits`) and made the rendering kind-aware, same pattern as
  mobile. Admin's `NeedsPage` progress column also generalized (`moneyProgress` → `progressLabel`)
  to show kit progress in the queue/browse table, not just money.
- All three frontends: `tsc`/`vite build` (web-panel, admin) and `tsc --noEmit` + `expo export
  --platform ios` (mobile, 660 modules) all clean, run **after** the admin/web-panel bug fix too.

**Not done / caveat:** Web-panel still has no kit-**posting** UI (only mobile does) — the
type/rendering fix there is defensive (so it won't crash if a kit need's contributions are ever
viewed from web-panel), not a new feature; TASKS.md's institution-web-panel line already tracks
this as partial. No simulator/browser to see any of this render, same standing caveat as every
session since Milestone 0.

**Next:** Milestone 4 — Blood module (write PRD §8 first, out of the numeric gap left since
Session 14 jumped to §9 ahead of §8): donor blood profile, India eligibility gap rules,
geo+eligibility-matched notifications, response flow. This is the first genuinely custom module
(CLAUDE.md §3) — it does *not* reuse the Money/Kit donate-and-confirm pattern the same way.

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

**Update (same session):** the user flipped "Public bucket" on in the Supabase dashboard
(Storage → `uploads` → Edit bucket). Re-ran a completely fresh sign → PUT → unsigned-GET cycle
and got a clean 200 with byte-for-byte matching content — **the full object-storage pipeline is
now confirmed working end to end**, not just diagnosed. (An old diagnostic test object from
before the fix now 404s with `"Object not found"` instead of `"Bucket not found"` — expected,
just garbage-collected test data, not a problem.)

**Not done / caveat:** QR-code upload for a `MONEY` need's `upi_qr` field is *not* wired into
`CreateMoneyNeedScreen` — only the donate-proof upload got built; typing a UPI ID still works
without it. Web-panel doesn't have image upload UI either (it only confirms/rejects
contributions, doesn't donate). No simulator/browser to see any of this render, same standing
caveat as every prior session.

**Next:** storage is done — resume Milestone 3 (Kits, PRD §9 first) per TASKS.md's build order, or
push to GitHub + get the backend itself deployed (only its Postgres is on Railway right now; the
Express server isn't deployed anywhere, so the Vercel-hosted admin/web-panel currently have
nothing real to talk to except localhost). User chose to pause on both at the end of the prior
turn specifically to nail down storage first — worth explicitly asking which to pick up now
rather than assuming.

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
