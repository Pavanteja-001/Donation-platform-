# DECISIONS.md — Decision Log

> Every meaningful product/architecture decision goes here.
> Format per entry: **what** was decided, **why**, **alternatives considered**, **impact**.
> Never delete an entry — if a decision is reversed, add a new entry that supersedes it.

---

### D-001 · Payments in v1: direct UPI/QR, no gateway
- **Decision:** Beneficiary shows their UPI ID / QR. Donor pays them **directly**. Donor uploads a
  screenshot / UTR as proof. No payment gateway and no escrow in v1.
- **Why:** Fastest path to a working product; avoids payment-gateway integration, fund-holding, and
  the legal/compliance weight of escrow at this stage.
- **Alternatives:** (a) Gateway + platform processes money — deferred to a later version.
  (b) Escrow — rejected for v1 (compliance burden).
- **Impact:** Verification is human until a gateway exists. Money records must store UTR, amount,
  timestamps, and who confirmed, so they can graduate to a gateway later without redesign.

### D-002 · Donation confirmation: beneficiary confirms, admin overrides
- **Decision:** The **beneficiary** confirms they received a donation; the **admin** can override.
- **Why:** The person who received the money is the best witness; a screenshot alone can be faked.
- **Alternatives:** Admin-only (slower, bottleneck); either party (weaker accountability).
- **Impact:** Donation object needs a `confirmed_by` field and a dispute/override path.

### D-003 · v1 scope = all flows; build order is sequential
- **Decision:** All flows are in v1 scope in the PRD. The **build** is sequenced (see PRD §5 / TASKS.md).
- **Why:** User wants the full vision documented; Claude Code builds one thing per session under
  credit limits, so an explicit order prevents ambiguity and half-built features.
- **Impact:** PRD covers everything; TASKS.md drives what actually gets built next.

### D-004 · Kits support both funding modes
- **Decision:** For grocery/education kits, support **both** "donate money per kit (NGO/beneficiary
  buys)" and "donor buys & delivers the kit."
- **Why:** User requested both.
- **Impact:** Kit fulfillment has a `mode` (money | deliver) affecting the confirmation flow.

### D-005 · Blood matching is eligibility-aware
- **Decision:** Match blood requests on blood group + location **and** donor eligibility (last-donation
  date vs. India gap rules ~90d men / ~120d women, age 18–65) + an "available to donate" toggle.
  Design so it *could* integrate eRaktKosh later; not in v1.
- **Why:** Notifying ineligible donors makes the alert system noise people mute.
- **Impact:** Donor profile stores blood group, last_donation_date, availability; eligibility is computed.

### D-006 · Certificates are platform records, not official documents
- **Decision:** Digital certificates are **platform records / thank-yous**, not official medical or
  government certificates — unless a hospital/blood bank actually issues one.
- **Why:** Legal/ethical: can't imply official medical certification the platform can't grant.
- **Impact:** Certificate wording and UI must avoid "official/medical/government" framing.

### D-007 · Institution onboarding requires type-specific KYC
- **Decision:** Institutions upload identity documents at registration and are admin-verified before
  posting. Fields: legal name, registration number, **Darpan ID (NGOs)**, identity **certificate
  (PDF/JPEG)**, address, bank account, photos. **Required fields depend on institution type** — a
  hospital/blood bank uses its own licence/registration rather than a Darpan ID.
- **Why:** Verified institutions are the backbone of trust; wrong-type fields (asking a hospital for a
  Darpan ID) would block legitimate registrations.
- **Impact:** Institution model needs a `type` and a per-type document checklist; a verification queue
  in the admin console; a "verified" badge.

### D-008 · Blood requests: institution-assisted verification + live status sync
- **Decision:** A blood `Need` can be **linked to a hospital/blood bank**, which can **verify** it
  (fast-tracking time-critical cases); **admin also verifies**. The need is visible on the
  beneficiary's mobile side and the institution's web panel. **Status is a single source of truth,
  pushed in real time to every panel** — no surface ever shows a stale status.
- **Why:** Institution vouching is faster and more credible than admin-only review for urgent blood;
  synced status prevents confusion when several parties act on the same request.
- **Alternatives:** Admin-only verification (too slow for emergencies); polling instead of push
  (stale views). Rejected.
- **Impact:** `Need` needs an optional `linked_institution` and multiple verification sources
  (`admin_verified`, `institution_verified`). Requires real-time transport (e.g. WebSockets / push)
  so mobile, institution, and admin panels stay in sync.

### D-009 · Adopted enhancements for v1: UPI deep-link, tri-language, WhatsApp
- **Decision:** Commit three items from IDEAS.md to v1: (a) **UPI deep-link** (`upi://pay?...` with
  amount pre-filled, alongside QR); (b) **Telugu + Hindi + English** with i18n from day one;
  (c) **WhatsApp** for urgent-blood alerts and "share this need."
- **Why:** All three are high-leverage for India — faster/error-free payments, wider reach and trust,
  and WhatsApp's dominant reach for emergencies.
- **Impact:** i18n framework from the start; UPI-intent link builder; WhatsApp integration
  (*verify Business API terms/costs* before building that part).

### D-010 · Location model + v1 notification scope
- **Decision:** At registration, capture the donor's **permanent ("go-to") location** — city + area.
  **This registered location is the basis for all notifications — no real-time GPS / no live tracking.**
  v1 blood notifications go to **all eligible donors whose permanent location is in the request's city**
  — **no radius, no SOS** (both deferred).
- **Donor-facing location:** the donor **can see the exact location where they'll donate** (hospital /
  pickup / delivery point) so they know where to go — revealed once the need is **admin-approved / the
  donor engages**. Public feed shows only the **area** for an individual beneficiary; institution
  locations (hospitals/blood banks) are public.
- **Why:** Permanent location is simpler, privacy-safe (no live tracking), always available, and enough
  for city-level matching; donors still get the precise spot when it actually matters.
- **Alternatives:** Real-time GPS matching — unnecessary and privacy-heavy; rejected.
- **Impact:** Registration captures a permanent location; Need carries a location; notification
  targeting filters by donor's permanent city + eligibility; exact-location reveal is gated on
  approval/engagement.

### D-011 · Tech stack (resolves O-1) + performance rules
- **Decision:** React Native (**Expo prebuild**) mobile; React web panels; Node backend on **Railway**;
  **PostgreSQL** on Railway; images in an **object-storage bucket** (Cloudflare R2 or Supabase Storage)
  behind a **CDN**; **WebSockets** for live sync; **Expo push** (via FCM/APNs) for notifications.
- **Performance rules (must feel instant):** `expo-image` (cached), **FlashList** for feeds,
  backend-generated **WebP thumbnails** (never send full-res to lists), pagination, skeleton loaders,
  optimistic UI. Images never live in Postgres or on the app server.
- **Why:** Proven, cost-effective India-friendly stack; the image/list rules are where "no lag" is won.
- **Impact:** Set up bucket + CDN + a thumbnail pipeline early; wire WebSockets for D-008.

### D-012 · Urgency levels & emergency feed
- **Decision:** Needs have an urgency level (**Normal / Urgent / Emergency**). **Emergency** needs are
  pinned/prioritised in the feed **until fulfilled** and trigger notifications to eligible donors.
  Urgency is **set/verified by admin** (or the linked hospital/blood bank for blood) — **not
  self-declared** — to prevent gaming.
- **Why:** If beneficiaries could self-mark "Emergency", everyone would, and the signal dies.
- **Impact:** `urgency` field on Need; feed ranking = urgency → recency; admin/institution controls
  urgency; "eligible" = blood group + eligibility + city (blood) or city + opted-in cause (other types).

### D-013 · Over-fund & completion (resolves O-3)
- **Decision:** A money/kit need **auto-closes at 100%**, stops accepting further contributions, and
  moves to a **"Completed" section**. A need whose **deadline passes unfunded** → **EXPIRED**; the
  beneficiary can re-submit it. The Completed section can double as a public **impact wall**.
- **Why:** Clean, avoids awkward over-collection; a visible Completed/impact area builds trust.
- **Impact:** Fulfilment logic caps at target; UI needs a Completed/Impact section; EXPIRED + re-submit.

### D-014 · One shared design system + one backend across all surfaces
- **Decision:** The donor mobile app, institution/hospital web panel, and admin console all consume
  **one backend/API** (single source of truth) and **one shared design system** — same theme, tokens,
  and components everywhere. No surface defines its own colours or components. See PRD Appendix A.
- **Why:** A unified, professional feel; a single backend keeps data and status in sync across all
  three surfaces (reinforces D-008 live sync).
- **Impact:** Build a shared design-token + component layer; all clients hit the same API.

### D-015 · Auth — phone OTP (static in dev)
- **Decision:** Login is **phone number + OTP** for all roles. **In development the OTP is static
  `123456`** (placeholder) until a real SMS provider is integrated.
- **⚠️ Must-fix before launch:** replace static OTP with a real provider and **rate-limit** OTP
  requests/attempts. Never ship static OTP to production — it lets anyone log in as anyone.
- **Impact:** OTP flow now; provider integration + rate limiting before any real users.

### D-016 · Notifications — Expo push + emergency priority + WhatsApp
- **Decision:** Mobile notifications via **Expo push**. **Emergency** needs use a **high-priority
  channel** (heads-up + sound) so they stand out. **WhatsApp** is used for **sharing** needs. No
  SMS/email fallback in v1.
- **Impact:** Set up Expo push + a dedicated high-priority channel for Emergency; a WhatsApp share action.

### D-017 · Rejection reasons + live propagation
- **Decision:** Any **rejection** (e.g. admin marks a request fake/invalid) **requires a reason**. The
  reason is shown to the poster and **updated in real time on every surface** (D-008). Same live pattern
  for any status change.
- **Impact:** Rejection needs a mandatory reason field; reason surfaces on the poster's view; live sync.

### D-018 · Admin roles (RBAC): Admin + Staff
- **Decision:** Two roles on the admin panel. **Admin (super)** can create **Staff** logins. Staff log
  into the **same panel** but see a **limited feature set**: they can **verify/accept** requests and
  **view/list all users** (donors, institutions, hospitals) — but **cannot** create/edit/delete users,
  manage staff, change settings, or override confirmed donations; those are **admin-only / escalate to
  admin**. All views are real-time. *(Default split — adjust as needed.)*
- **Impact:** Role-based permissions (RBAC); a staff-management screen; an all-users listing screen;
  permission checks on every sensitive action.

### D-019 · UTR uniqueness (hard block)
- **Decision:** A given **UTR cannot be uploaded twice** — enforce **uniqueness via a DB unique
  constraint**, not just a flag. Supersedes the "flag reused UTRs" note in the old O-9.
- **Why:** A real UTR is unique per transaction; blocking duplicates stops the simplest fraud/mistake
  and removes any race between two uploaders.
- **Impact:** Unique constraint on the contribution's UTR; a clear error on duplicate.

### D-020 · Milestone 0 implementation choices (backend ORM, User model shape, admin provisioning)
- **Decision:** (a) Backend uses **Prisma** as the ORM/migration tool over Postgres (Express +
  TypeScript). (b) A **single `User` table** with a `role` enum (`USER` / `INSTITUTION` / `ADMIN` /
  `STAFF`) backs all four account kinds — `USER` covers both Donor and Beneficiary since PRD §4
  treats them as the same mobile account acting in two capacities, not separate account types.
  (c) `ADMIN`/`STAFF` **cannot self-register** through `/api/auth/otp/verify` (only `USER`/
  `INSTITUTION` can); the first `ADMIN` comes from a seed script, and that `ADMIN` creates `STAFF`
  accounts via `POST /api/admin/staff` (D-018).
- **Why:** Prisma gives type-safe queries + migrations that match the fast-moving `Need`/
  `Contribution` schema coming in Milestone 1. Collapsing Donor/Beneficiary into one `USER` role
  matches the product model instead of inventing an account distinction the PRD doesn't make.
  Blocking Admin/Staff self-registration closes the obvious hole D-018's RBAC would otherwise have
  (anyone posting `role: "ADMIN"` to the verify endpoint).
- **Impact:** `backend/prisma/schema.prisma` is the schema source of truth; `backend/prisma/seed.ts`
  provisions the founding admin (`SEED_ADMIN_PHONE` env var).

### D-021 · Object storage: Supabase Storage (resolves the R2-or-Supabase "or" in D-011)
- **Decision:** Use **Supabase Storage**, via its **S3-compatible API**, not Cloudflare R2. The
  backend signs short-lived upload URLs (`POST /api/uploads/sign`); the client uploads the file
  **directly to the bucket**, never through the backend, and only the resulting URL is stored in
  the DB (e.g. `Contribution.proofUrl`). Bucket: `uploads`, one bucket for now with a `folder`
  namespace per use (`contribution-proofs`, `need-qr`, …) rather than one bucket per use case.
- **Why:** R2 requires a payment method on file to activate even within its free tier; the user
  doesn't have one available right now. Supabase Storage's free tier (1GB storage, 2GB
  bandwidth/month) needs no card. Both were already-locked options in D-011, so this just resolves
  the "or" rather than introducing a new choice.
- **Gotcha (matters if this ever gets re-implemented):** Supabase's **public object URLs are
  served from the main project domain** (`https://<ref>.supabase.co/storage/v1/object/public/...`),
  **not** the S3-compatible domain (`https://<ref>.storage.supabase.co/...`) used for signing
  PUT/GET requests. `backend/src/lib/storage.ts` derives the project ref from the S3 endpoint's
  hostname to build the public URL — if Supabase ever changes that hostname pattern, this breaks.
- **Impact:** New env vars `SUPABASE_S3_ENDPOINT`/`_ACCESS_KEY_ID`/`_SECRET_ACCESS_KEY`/`_BUCKET`/
  `_REGION` (`backend/.env.example`). The `uploads` bucket must be set **public** in the Supabase
  dashboard for the stored URLs to actually resolve — this is a manual one-time step outside the
  codebase (Storage → bucket → Edit bucket → Public bucket).

### D-022 · Meal-slot locking: conditional UPDATE, not check-then-act; reject reopens the date
- **Decision:** A `MEAL_SLOT` need gets a child `MealSlot` row per calendar date (institution
  defines the bounded date list at creation, capped at 60 dates; fixed after submission — same
  reasoning as Kit's `mode`, D-004). Booking a date is a single conditional `UPDATE "MealSlot" SET
  status='BOOKED', contribution_id=:cid WHERE id=:slotId AND status='OPEN'` inside the same
  transaction that creates the `Contribution` — never a read-then-write from the application.
  Postgres serializes concurrent `UPDATE`s to the same row, so exactly one of two racing requests
  affects a row; the app checks the affected-row count and fails the loser with "pick another
  date." Progress (`slots_confirmed`) only increments on **confirm** (same audit principle as
  `raised_amount`/`kits_funded`), but the **lock** happens at **booking**, since that's when the
  race actually occurs. On **reject**, the slot goes back to `OPEN` (not stuck `BOOKED`) — the one
  place this type's confirm/reject differs from Money/Kit, because a rejected contribution there
  just doesn't count, but here rejection must also free the date back up or one bad payment claim
  permanently blocks it.
- **Why:** No two donors can ever be told they've booked the same date — that's the entire
  point of this being one of the two custom modules (CLAUDE.md §3). A `SELECT` then `UPDATE`
  app-side is a textbook race under concurrent requests; the DB's own row-update semantics are a
  correct lock without needing an explicit `SELECT ... FOR UPDATE`, `SERIALIZABLE` isolation, or a
  distributed lock. This is the same "conditional update, check the affected-row count, never
  check-then-act" pattern already used for UTR uniqueness (D-019).
- **Alternatives:** App-level check-then-act (rejected — race-prone under concurrency); a
  distributed lock / Redis mutex (rejected — unnecessary complexity, Postgres already gives this
  for free at the row level); `SERIALIZABLE` transaction isolation for the whole booking flow
  (rejected — the conditional `UPDATE`'s WHERE clause is sufficient and cheaper).
- **Impact:** New `MealSlot` Prisma model with a `(need_id, date)` unique constraint;
  `Need.payload` for MEAL_SLOT carries `slots_total`/`slots_confirmed` (server-computed only,
  never accepted from the client, same tamper-guard as every other progress field); booking and
  confirm/reject routes must wrap their state changes in a DB transaction with the conditional
  `UPDATE`, not a plain `findUnique` + `update`.

### D-023 · Q&A Forum: Dedicated ForumQuestion and ForumAnswer entities, ADMIN/STAFF moderated
- **Decision:** Build Q&A using separate, dedicated database models: `ForumQuestion` and `ForumAnswer`. Authenticated users (`USER`, `INSTITUTION`) can ask questions and reply with answers. `ADMIN` and `STAFF` roles can delete posts for moderation.
- **Why:** Q&A questions do not fit the `Need` entity's state lifecycle (DRAFT -> LIVE -> FULFILLED) or verification rules. Modeling them separately keeps the `Need` table clean and avoids polluting list views.
- **Impact:** Create `ForumQuestion` and `ForumAnswer` models in Prisma schema. Expose clean REST endpoints for listing, creating, and deleting questions/answers.

### D-024 · Volunteering (SKILL_REQUEST): Reuses the shared Need and Contribution engine
- **Decision:** Model volunteering needs as a new `NeedType` (`SKILL_REQUEST`). The payload houses the volunteer count target (`volunteers_needed`), date, and role required. Joining a volunteering task creates a `Contribution` of `kind: SKILL_REQUEST` with status `PENDING_CONFIRMATION`. Once the institution verifies attendance and confirms the contribution, `volunteers_joined` increments. When target is reached, need auto-closes to `FULFILLED`.
- **Why:** Matches the exact direction, lifecycle, and verification pattern of the existing `Need` and `Contribution` framework, making it completely zero-cost to integrate into existing listing feeds, verification queues, and transaction logs.
- **Impact:** Add `SKILL_REQUEST` to `ContributionKind` enum in the database. Add custom validation rules for `SKILL_REQUEST` needs and contributions in the API routing layer.

---

### D-025 · Brand palette: crimson is the primary colour (supersedes the red-reservation rule in D-014)
- **Decision:** The mobile app's primary/brand colour is **deep crimson `#B91C1C`** (`primaryDeep #7F1D1D`, `primaryBright #DC2626`), on a **warm blush off-white canvas `#FBF7F7`**. This replaces the emerald-teal primary (`#0F766E`). D-014's rule that "red is reserved for danger/emergency/blood only" **no longer holds** — red now carries every primary action.
- **Why:** Client direction, after reviewing the built teal UI against the reference designs they supplied (SaveLife / Donorin blood-donation concepts): the app read as "very white" and off-brand for a platform whose flagship module is blood donation. The reference designs are unambiguously crimson-led with dark red gradient heroes.
- **How urgency still reads, now that hue is no longer available as the signal:** emergency is distinguished by **intensity + treatment**, not colour family —
  1. a hotter red (`emergency #EF4444`) than the brand crimson,
  2. **solid** badge fills where normal states use soft tints,
  3. the radiating `EmergencyPulse` ring,
  4. a full-bleed gradient strip on the card.
  Do **not** introduce a second accent hue to compensate — that would reintroduce exactly the ambiguity this structure avoids.
- **Impact:**
  - `mobile/src/lib/theme.ts` rewritten: crimson brand ramp, warm neutral ramp (replacing the blue-grey slate ramp), new `gradient` tokens, crimson `glow`, warm shadow colour.
  - New `mobile/src/components/Gradient.tsx` — a stacked-band linear gradient, so the reference designs' dark crimson hero washes cost **no native dependency** (`expo-linear-gradient` is not installed and would force a prebuild). Swap the implementation for `expo-linear-gradient` later and every call site keeps working.
  - `app.json` Android notification accent `#0E7C66` → `#B91C1C`.
  - `success` green is retained deliberately and used sparingly (confirmed / verified / completed) — it is now the only way those states can read as distinct from the brand.
  - **Outstanding:** the **institution web panel and admin console still carry the old teal tokens**. D-014 requires one design system across all three surfaces, so they are now visually out of sync with mobile. Client has explicitly deferred this ("later we change other panel admin"). Until then D-014's single-theme guarantee is knowingly broken.

---

### D-026 · Map coordinates: the poster's pin is the truth, district/area centres are the fallback, and coordinates live in the DB
- **Decision:** Three rules, in order:
  1. **An exact pin wins.** Whatever the poster (or admin/institution) drops on the create-need map picker is stored verbatim and is what every map plots.
  2. **No pin → server-side fallback.** `POST/PATCH /api/needs` resolves `area` → `district` centre from the `Area`/`District` tables and stores that. Approximate, but genuinely in the right locality.
  3. **Nothing resolvable → no coordinate, and no marker.** A need with `latitude`/`longitude` null is listed as "no pinned location", never drawn at a stand-in position.
  Coordinates moved out of the per-client `CITY_COORDINATES` constants into `District.latitude/longitude` and `Area.latitude/longitude`, served by `GET /api/locations` (areas are now objects, not bare name strings) and editable by admins (`PATCH /api/admin/locations/districts/:id` and `/areas/:id`). The client-side tables survive only as an offline fallback for when `/api/locations` fails.
- **Why:** The hardcoded tables were the direct cause of needs rendering in the wrong city. The DB district is named `"Vijayawada (NTR)"`, the mobile table's key was `"ntr (vijayawada)"` — no match, and the lookup then fell back to `CITY_COORDINATES["visakhapatnam"]`, so every NTR request pinned on the Vizag coast. Only 5 of ~70 seeded areas had an entry at all. A table that lives in three client bundles cannot stay in sync with districts an admin creates at runtime; one that lives next to the districts themselves can.
- **This is only about map coordinates.** Blood-alert routing is unchanged and does not use coordinates: `notifyEligibleBloodDonors` matches `need.city`/`need.area` **strings** against `user.city`/`user.area` (D-010). The district/area dropdowns, and what gets stored in `need.city`/`need.area`, are untouched.
- **Impact:**
  - `District`/`Area` gain nullable `latitude`/`longitude`; `prisma/seedLocations.ts` seeds all 7 districts and 69 areas. Area values are **approximate locality centres** (~1 km), enough to open the picker on the right neighbourhood — never to be treated as an address. Admins refine them from the Locations page.
  - `prisma/backfillNeedCoordinates.ts` (one-off) gives pre-existing needs the same fallback so they don't disappear from the map.
  - Need coordinates are range-validated (`±90`/`±180`) and must be sent as a pair; half a coordinate is a 400.
  - Clients no longer send a coordinate they had to invent: an empty/unparseable box submits nothing (`Number("")` was silently posting `0,0`).

---

### D-027 · Mobile depth pass: native gradient/blur/SVG adopted (supersedes D-025's "zero native dependencies")
- **Decision:** Install `expo-linear-gradient`, `expo-blur` and `react-native-svg` in the mobile app. `components/Gradient.tsx` keeps its exact props but is now a real `LinearGradient` (the 32 stacked-band fake is gone, and `bands` is accepted-and-ignored for call-site compatibility). New `components/Depth.tsx` holds the shared primitives: `IconPlate`, `DepthCard`, `LitEdge`, `litRamp()`.
- **Why:** Client review — the UI read as flat and unfinished. Three things caused it, and none could be fixed with the stacked-band approach: elevation opacities (0.04–0.10) sat below the perceptual threshold on a phone in daylight; icons were flat tinted squares; and every surface was uniformly lit, so nothing had direction.
- **The rule that holds it together — one light source, top-left.** A raised surface is brightest at its top-left edge, its own colour in the middle, darkest at the bottom-right, and casts a warm shadow down-right. Recessed surfaces invert it. Applying that consistently is what reads as dimensional; individual effects don't.
- **Impact:**
  - **Requires a native rebuild** (`npx expo run:ios` / `npx expo run:android`, or a new dev-client build). This is the cost D-025 was avoiding; the client accepted it.
  - Elevation opacities raised to 0.08/0.12/0.18, plus a new `level4` for floating surfaces.
  - New gradient tokens: `surfaceSheen`, `plateBrand`, `plateNeutral`, `gloss`.
  - Applied so far: feed cards + My Needs cards (sheen + `IconPlate`), filled buttons (lit ramp + gloss), tab bar (real `BlurView` frosted pill on `level4`). Hero surfaces get true gradients for free via `Gradient`.
  - `react-native-svg` is installed but not yet used — it's there for illustrated empty states, which is the next step, not something this pass delivered.
  - Outline/ghost buttons stay deliberately flat: they are not raised surfaces, and shading them would contradict the light model.

---

### D-028 · Community panel in the mobile menu: admin-curated content, one derived leaderboard
- **Decision:** The mobile menu drawer gains five blocks below the existing Explore links — **Safety & Emergency Support**, **Trust & Transparency**, **Success Stories**, **Top Supporters**, **Upcoming Events** — plus a closing **Make an Impact Today** call to action. Three of them are backed by new admin-managed tables (`Helpline`, `SuccessStory`, `PlatformEvent`), edited from three new admin console pages and read by the app from `/api/community`. Each block has a "View all" screen in the app.
- **Trust & Transparency is deliberately NOT data.** "100% transparent", "0% platform fee", "Verified & secure", "Direct impact" are claims about how the platform works, not copy to tune per deployment. They live in `components/CommunityBlocks.tsx`. If one stops being true that is a code change and a decision record — not a form field an admin can quietly edit.
- **Top Supporters has no table.** It is derived on every read from `Contribution` rows that are `CONFIRMED` **and carry an `amount`** — so it ranks on money only; a BLOOD or GOODS contribution has `amount: null` and cannot move anyone up the list. A stored leaderboard would be a second source of truth for money already recorded, and would drift from it the first time a contribution was rejected. The app says plainly what the ranking measures, so a blood donor doesn't read their absence as the platform ignoring them.
- **What a supporter row exposes (CLAUDE.md §7):** rank, name, photo, total amount — and blood group **only** when the donor has both filled in a group and left `availableToDonate` on, i.e. is already presenting as an available donor on this platform. Toggling that off removes the group from the leaderboard immediately. Nothing else — no phone, no city, no need history. Name and amount are already public on each need's contribution list, so the block reveals no more than the feed does. *If a dedicated "show my blood group publicly" consent flag is wanted later, that is the one field to change.*
- **Helplines are seeded, not hardcoded.** `prisma/seedCommunity.ts` upserts the six numbers from the design (matched on `number`, so re-running is safe). Hardcoding them in the app would mean an app-store release to correct a number someone may be dialling in a crisis; shipping with an empty safety section would be worse than either.
- **One `/api/community/menu` request for the whole drawer.** The panel slides over the current screen with no loading state of its own, so four separate calls would show four blocks popping in one after another on a slow connection. Cached under a `community:` namespace that any admin write drops wholesale (a helpline edit invalidates the payload named "stories" too, so selective invalidation would be a bug waiting to happen). The supporters key gets a short TTL instead, because confirming a donation moves the leaderboard and is a donor action that never calls the admin invalidation path.
- **Writes are ADMIN-only; STAFF can read.** Editing what every user sees in the app is settings-grade under D-018. Staff still get the lists so they can answer support questions about what the app is showing.
- **Images are cropped in the console, before upload.** The app renders these at fixed shapes (16:9 banner, 1:1 icon, 4:3 story cover); cover-fitting an arbitrary phone photo into a 16:9 slot cuts the head off whoever is in it. `components/ImageCropper.tsx` exports a fixed-size **WebP** (D-011 — never send full-res to a list). Story gallery photos take a centre crop without a dialog; the cover, which has to frame a face, goes through the interactive cropper.
- **The "Make an Impact" card is built, not shipped as the artwork.** The reference image includes the button; a picture of a button is not tappable, does not reflow, and has no pressed state. Only the heart is an image (`assets/impact-heart.webp`, cropped from the supplied PNG); the rest is real text and a real control wired to the create-need flow.
- **Impact:** new `Helpline` / `SuccessStory` / `PlatformEvent` models + `EventMode` enum (migration `20260803190000_add_community_content`); `routes/community.ts` (public + admin routers); `community` upload folder; six new mobile screens and `SideDrawer` rebuilt (panel widened 0.75 → 0.86 so the CTA's text column doesn't wrap); three new admin pages and the cropper.

---

### D-029 · Console roles cannot donate — ADMIN/STAFF verify and confirm, they never contribute
- **Decision:** `POST /api/needs/:id/contributions` and `POST /api/needs/:id/meal-slots/:slotId/book` now return **403** for ADMIN and STAFF. Only USER and INSTITUTION can donate (PRD §4). ADMIN/STAFF contributions are also excluded from the Top Supporters leaderboard (D-028) and from the home screen's `amountRaised`.
- **Why — the same person was on both sides of a money record.** `canDecide` (routes/contributions.ts) lets an ADMIN confirm the contributions on *any* need, so an admin donation is a donation nobody independent ever checked. That is exactly the audit property D-002 ("beneficiary confirms; admin can override") exists to protect, and nothing enforced it: the donate endpoint had **no role check at all**.
- **It was not hypothetical.** The seeded admin account had accumulated **five confirmed contributions** from manual testing on 2026-07-27, with junk UTRs (`Gyg`, `Gug`, `Endj`) — including a ₹39,99,80,000 KIT contribution. Effects, all live until this change:
  - It held **rank 1** on Top Supporters with ₹40,08,72,431, ahead of every real donor.
  - It made up **99.97%** of the public "amount raised": ₹40,10,12,110 → ₹1,39,679 once excluded. The home screen was advertising ₹40 crore of test money.
- **Two layers, deliberately.** The endpoint guard stops new rows; the read-side filters (leaderboard + stats) keep the *existing* rows out of public figures and mean the two can never disagree if someone loosens the guard later.
- **Not touched:** admins can still **post** needs (the Post a Need page is intentional — an admin filing a need on someone's behalf is a different act from funding one), still confirm/override, and INSTITUTION accounts still donate normally.
- **Known residue:** the five historical rows remain in the database and still back their needs' own `raised_amount`/`kits_funded` counters — all five needs are already FULFILLED. Global figures are now honest; those five need pages still show progress funded by admin test money. Deleting the rows would need the payload counters recomputed and the FULFILLED status reconsidered, so it is a deliberate data-repair task, not a side effect of this change.

---

### D-030 · Nobody funds or vouches for their own request; every rupee needs evidence
Follow-on from D-029, after auditing the same class of gap across every money path. Three rules, all enforced server-side and mirrored in the clients:

**1 · You cannot donate to a need you posted.** `POST /needs/:id/contributions` and `POST /needs/:id/meal-slots/:slotId/book` return **403** when `need.postedById` is the caller. Reproduced before the fix, as an ordinary USER with no special account: post a ₹40,000 need → "donate" ₹40,000 to it with the fabricated-but-well-formed UTR `777000111999` → confirm your own payment (D-002 makes the beneficiary the confirmer) → the need reads **FULFILLED**, the money enters the public total, the trust tier rises to SILVER and a certificate becomes available. No money ever moved and nobody independent checked. This is D-029's admin case generalised, and the more dangerous one because anyone can do it. Enforced at contribution time, not at confirm time, so the misleading record is never created at all. *The mobile app never offered this — every donate affordance is already gated on `!isOwner` — so it was an API-only hole; that is precisely why it needed to be closed in the API.*

**2 · You cannot confirm a donation you made.** `POST /contributions/:id/confirm` returns 403 when `donorId` is the caller. Redundant with rule 1 in a clean database, kept because confirmation is the step that moves money into public totals and trust tiers — "the person who benefits is not the person who signs it off" is worth stating twice. **Rejecting** your own contribution stays allowed: withdrawing takes money *out* of the totals, and is the only way to undo a mistaken pledge.

**3 · Payment proof is mandatory wherever money moved.** `proofUrl` is now required for MONEY, and for KIT / MEAL_SLOT in `mode=MONEY`. Previously optional. With no gateway (D-001) a money record rests on a UTR and a screenshot; the UTR is only format-checked (12 digits, unique), so a fabricated one passes — which left the screenshot as the only thing a beneficiary could actually look at, and it was optional. DELIVER-mode pledges are exempt: no money has moved. Mobile now blocks submission without an image on all three flows, and the meal-slot booking UI gained the proof picker it never had.

**4 · Every need carries at least one photo.** Checked at `POST /needs/:id/submit` — not at create, so drafting over several sittings still works. An admin verifying a request otherwise has the poster's own words and nothing else; a photo of the prescription, school letter or the item being given away is what makes verification more than a vibe check, and a photoless card reads as an empty listing in the feed. **SKILL_REQUEST and QUESTION are exempt** — asking for a scribe has nothing to photograph, and forcing one would only produce filler. All 15 create forms (5 mobile, 5 admin, 5 web-panel) validate before upload. *BLOOD is the one place this costs the poster time on an urgent request; kept in scope because a hospital slip is exactly what lets an admin fast-track it. Revisit if it slows real emergencies.*

**Still open (deliberately not fixed):** an approved INSTITUTION can post a need with `linkedInstitutionId` set to **itself** and then call `POST /needs/:id/institution-verify` to publish it LIVE without admin review — nothing checks that the linked institution differs from the poster. D-008 intends a hospital vouching for *someone else's* time-critical request, i.e. a second pair of eyes. Left as-is for now on the reasoning that institutions are already admin-KYC-approved; **if that is the intent it should be written into D-008 explicitly**, because today it reads like an oversight.

**Also audited and clean:** urgency is admin/linked-institution only and a poster's own value is silently dropped · `raised_amount`/`kits_funded`/`units_fulfilled` are server-computed and cannot be posted by a client · need editing is DRAFT-only · STAFF cannot confirm or override · institution KYC is enforced before posting · `bloodDonors` counts self-declared blood groups, already documented as deliberate in stats.ts.

---

### D-031 · Deleting a row deletes its files; replacing an image deletes the one it replaced
- **The gap:** **nothing in the platform had ever deleted a single object from the bucket.** Not one call site. Deleting a need dropped the row and left its photos and UPI QR behind; deleting a success story or event left its cover, gallery and banner; and every *replacement* — a new profile photo, a swapped story cover, a re-picked draft photo — stranded the previous file forever. Object storage bills for what is stored, not for what is reachable, so this was a line item that could only ever grow, entirely composed of files nothing could display again.
- **Decision:** `lib/storage.ts` gains `deleteObjects(urls)`, `deleteReplacedObjects(before, after)` and `keyFromPublicUrl(url)`, wired into every path that drops or swaps an image:
  - `DELETE /admin/needs/:id` → `photos[]` **and** the `upi_qr` inside the JSON payload (the one image a plain `photos` read misses)
  - `DELETE /admin/community/{helplines,success-stories,events}/:id` → icon / cover + gallery / banner + icon
  - `PATCH` on all three community types → whatever the edit dropped, including a photo removed from a story gallery
  - `PATCH /auth/me` → old profile photo, orphanage cover, removed gallery photos. This is the highest-volume leak on the platform: changing your profile picture is the most repeated write there is.
  - `PATCH /needs/:id` (DRAFT edit) → photos and QR the edit replaced
- **`keyFromPublicUrl` is deliberately strict.** It returns null unless the URL matches our exact public-URL shape *and* lands in one of the six folders `createUploadUrl` writes to. URL columns legitimately hold things we did not upload — an event's `registrationUrl` points at someone else's form — and the cost of being loose is deleting a file we had no business touching.
- **Cleanup never fails a request.** Every call is fire-and-forget and swallows its own error (logged, not thrown), and always runs *after* the row write, never inside the transaction. A leaked file is a rounding error on a bill; a delete that reports failure after having succeeded is a support ticket and a double-delete attempt. Same "accelerator, never a dependency" rule as the Redis cache.
- **KYC documents are exempt.** They are the evidence behind an approval decision (D-007) and an admin may need to see what was actually submitted long after a re-upload. An audit trail is worth more than the kilobytes.
- **The backstop: `npm run storage:sweep`** (`prisma/sweepOrphanedUploads.ts`). Lists the bucket, diffs against every URL column in the schema, reports what nothing references. Two categories of orphan will always exist and no request path can catch either: everything uploaded before this change, and **uploads whose form was never saved** — a client asks for a signed URL, PUTs the file, then the save 400s or the tab closes. That happened during this very session. **Dry-run by default; `--delete` to act; objects newer than `--min-age-days` (default 7) are never touched**, because "no row points at this" is indistinguishable from "the form is still open in another tab".
  - *If a new image field is ever added to the schema, it must be added to `referencedKeys()` in the same change.* A column missed there reads as "unreferenced", and with `--delete` that means deleting a live image. That is the one dangerous edge in this design, and it is why the script defaults to reporting.
- **First run:** 49 objects / 22.1 MB in the bucket, 37 referenced, 12 orphaned (5 too recent to touch) — 7 removable, 175.8 KB, mostly abandoned KYC and need photos from July testing. Small today; the point is that it was unbounded.
- **Not done:** no bucket lifecycle rule is configured on the Supabase side. The sweeper is a manual/cron tool, not an automatic policy — worth adding a lifecycle rule if uploads ever outgrow it.

---

### Open decisions (gap register — resolve before / during build)
- **O-10 · Legal/compliance** — terms, privacy policy, data-retention for KYC & health data (non-code, required).

### Resolved
- **O-1 · Tech stack** → **D-011** · **O-2 · Name** → DonationPlatform · **O-3 · Over-fund/deadline** → **D-013** · **O-4 · Design system** → **D-014**.
- **O-5 · Auth** → **D-015** · **O-6 · Notifications** → **D-016** · **O-7 · Dispute/rejection** → **D-017** · **O-8 · Admin roles** → **D-018** · **O-9 · UTR** → **D-019**.
- **O-11 · Q&A Forum** → **D-023** · **O-12 · Volunteering** → **D-024**.
