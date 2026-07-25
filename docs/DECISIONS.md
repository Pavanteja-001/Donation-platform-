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

---

### Open decisions (gap register — resolve before / during build)
- **O-10 · Legal/compliance** — terms, privacy policy, data-retention for KYC & health data (non-code, required).

### Resolved
- **O-1 · Tech stack** → **D-011** · **O-2 · Name** → DonationPlatform · **O-3 · Over-fund/deadline** → **D-013** · **O-4 · Design system** → **D-014**.
- **O-5 · Auth** → **D-015** · **O-6 · Notifications** → **D-016** · **O-7 · Dispute/rejection** → **D-017** · **O-8 · Admin roles** → **D-018** · **O-9 · UTR** → **D-019**.
