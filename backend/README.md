# DonationPlatform backend

Node + Express + TypeScript + Prisma + PostgreSQL. See root `CLAUDE.md` / `docs/PRD.md` for product context.

## Local setup

1. Start Postgres — either `docker compose up -d` from the repo root, or point `DATABASE_URL` at a
   local/Railway instance.
2. `cp .env.example .env` and fill in `JWT_SECRET`.
3. `npm install`
4. `npm run prisma:migrate` — applies the schema.
5. `npm run prisma:seed` — creates the first ADMIN account (phone from `SEED_ADMIN_PHONE`, default
   `+910000000000`).
6. `npm run dev` — serves on `http://localhost:4000`.

## Auth (D-015)

Phone + OTP for every role. **In dev, the OTP is always the static code `123456`** — see the
`⚠️ DEV-ONLY` warning in `src/lib/otp.ts`. This must be replaced with a real, rate-limited SMS
provider before launch.

- `POST /api/auth/otp/request { phone }` — no-op in dev (logs the static code to the console).
- `POST /api/auth/otp/verify { phone, code, role?, name? }` — creates the user on first login
  (`role` may only be `USER` or `INSTITUTION` here; `ADMIN`/`STAFF` accounts are provisioned
  separately, see below) and returns a JWT.
- `GET /api/auth/me` — current user (bearer token required).

## Roles & RBAC (D-018)

`Role` = `USER` (donor/beneficiary, mobile) · `INSTITUTION` (web panel) · `ADMIN` · `STAFF`
(admin console). `ADMIN` and `STAFF` cannot self-register:

- The **first ADMIN** comes from `npm run prisma:seed`.
- An ADMIN creates **STAFF** accounts via `POST /api/admin/staff`.

Admin-console permission split (`src/routes/admin.ts`):

| Route | ADMIN | STAFF |
|---|---|---|
| `GET /api/admin/users` (list all users) | ✅ | ✅ |
| `PATCH /api/admin/users/:id` (edit a user) | ✅ | ❌ |
| `GET/POST/DELETE /api/admin/staff` (manage staff) | ✅ | ❌ |

Need verify/accept endpoints (below) are gated the same way (`requireRole(Role.ADMIN, Role.STAFF)`).

## The Need engine (PRD §6, `src/routes/needs.ts` + `src/routes/admin.ts`)

Shared lifecycle for every need type — `DRAFT → PENDING_VERIFICATION → LIVE → PARTIALLY_FULFILLED
→ FULFILLED`, with `REJECTED`/`EXPIRED`/`CANCELLED` branches. Transitions are enforced centrally in
`src/lib/needLifecycle.ts` (`assertTransition`) — every route goes through it rather than writing
`status` directly.

- `POST /api/needs` — create (any `USER`/`INSTITUTION`), starts as `DRAFT`.
- `PATCH /api/needs/:id` — owner-only, `DRAFT`-only.
- `POST /api/needs/:id/submit` — owner-only, `DRAFT → PENDING_VERIFICATION`.
- `POST /api/needs/:id/cancel` — owner or Admin/Staff, any non-terminal status → `CANCELLED`.
- `GET /api/needs` — the public feed: `LIVE`/`PARTIALLY_FULFILLED` only, ranked Emergency → Urgent
  → Normal (D-012) then recency.
- `GET /api/needs/mine` — every need the caller posted, **any status** (including `DRAFT`/
  `PENDING_VERIFICATION`/`REJECTED`, which the public feed never shows) — how a poster tracks
  their own need. Must be registered before `GET /:id` (Express route order) or `/mine` gets
  swallowed as `id="mine"`.
- `GET /api/needs/:id` — owner, Admin/Staff, or anyone once it's publicly visible (`LIVE`+);
  404s otherwise (doesn't leak existence of private/rejected needs).
- `GET /api/admin/needs` — Admin + Staff. No `?status=` = the verification queue
  (`PENDING_VERIFICATION` only, oldest first — the actionable default). `?status=LIVE` (any
  `NeedStatus`) or `?status=ALL` for general oversight, newest first.
- `POST /api/admin/needs/:id/verify` — Admin + Staff, `PENDING_VERIFICATION → LIVE`.
- `POST /api/admin/needs/:id/reject { reason }` — Admin + Staff; `reason` is mandatory (D-017) and
  shown to the poster via `GET /api/needs/:id` or `/mine`.

Type-specific fields (target amount/UPI for `MONEY`, blood group/units for `BLOOD`, …) live in the
untyped `payload` JSON column for now — validated per type as each flow gets built (Milestone 2+).

`Need.deadline` is a shared (not per-type-payload) field so the lifecycle engine can read it
generically — see the Money flow section below for why.

## Money flow (PRD §7, `src/routes/needs.ts` + `src/routes/contributions.ts`)

- A `MONEY` need's `payload` is `{ target_amount, raised_amount, upi_id, upi_qr? }`.
  **`raised_amount` is always server-computed** — any client-supplied value on create/edit is
  silently dropped (`normalizePayload` in `needs.ts`), and it only ever changes via a confirmed
  Contribution. `POST /:id/submit` 400s until `target_amount` + `upi_id` are both set.
- `POST /api/needs/:id/contributions { amount, utr, proofUrl? }` — the donate step (D-001: no
  gateway, paid directly to the beneficiary's UPI outside the platform, this just records proof).
  409s unless the need is `LIVE`/`PARTIALLY_FULFILLED` (covers D-013's "stops accepting once
  FULFILLED"). **`utr` has a DB-level unique constraint (D-019)** — a duplicate 409s
  (`Prisma P2002`), not just an app-level flag.
- `GET /api/needs/:id/contributions` — owner or Admin/Staff only.
- `POST /api/contributions/:id/confirm` / `.../reject` — the need's beneficiary, **or ADMIN as an
  override** (D-002/D-018 — deliberately not STAFF, since "override confirmed donations" is
  admin-only). Confirm clamps `raised_amount` at `target_amount` and advances
  `LIVE → PARTIALLY_FULFILLED → FULFILLED` via `assertTransition`. Reject requires no reason in
  v1 (unlike rejecting a *Need*, D-017) — the donor can just resubmit with a corrected UTR.
- **Deadline expiry** (D-013) is checked **lazily** on every read (`src/lib/needExpiry.ts`) —
  there's no cron/scheduler yet. A `LIVE`/`PARTIALLY_FULFILLED` need past its `deadline` flips to
  `EXPIRED` the next time anyone reads it (feed, detail, etc.), not on a timer.
- `POST /api/needs/:id/resubmit` — owner-only, `EXPIRED → DRAFT`, so the poster can `PATCH` (e.g.
  push the deadline out) and submit again.

Proof-of-payment upload is wired up (see Object storage below) — `Contribution.proofUrl` is a
real bucket URL now, not a client-typed string.

## Object storage (CLAUDE.md §6, D-021, `src/lib/storage.ts` + `src/routes/uploads.ts`)

**Supabase Storage** via its S3-compatible API (D-021 — chosen over R2, which needs a card on
file even for its free tier). The backend never touches image bytes:

1. `POST /api/uploads/sign { contentType, folder }` (auth required) — `folder` is
   `"contribution-proofs"`, `"need-photos"`, or `"need-qr"`; `contentType` is
   `image/jpeg`\|`image/png`\|`image/webp`. Returns `{ uploadUrl, publicUrl, key }` —
   `uploadUrl` is a **5-minute presigned PUT URL**.
2. The client `PUT`s the file bytes straight to `uploadUrl` (never through this backend).
3. The client then sends `publicUrl`(s) as e.g. `Contribution.proofUrl` on
   `POST /api/needs/:id/contributions`, or `Need.photos[]` (folder `"need-photos"`, capped at 5,
   any need type) on `POST`/`PATCH /api/needs`.

Requires `SUPABASE_S3_ENDPOINT`/`_ACCESS_KEY_ID`/`_SECRET_ACCESS_KEY`/`_BUCKET`/`_REGION` in
`.env` (see `.env.example`) — **reads lazily**, so a missing/incomplete config only breaks
`/api/uploads/sign` (503) rather than crashing the whole server. The `SUPABASE_S3_BUCKET` bucket
must be set **Public** in the Supabase dashboard (Storage → bucket → Edit bucket) for `publicUrl`
to actually resolve; the S3 API itself (signing, PUT, and even a signed GET) works regardless of
that toggle — only the public read path depends on it. See D-021 for the gotcha on how the public
URL's hostname is derived from the S3 endpoint.

## Kit flow (PRD §9, `src/lib/kitNeed.ts` + `src/routes/needs.ts` + `src/routes/contributions.ts`)

Reuses the Money flow's engine end to end — same routes, same `computeFulfilment` pattern in
`contributions.ts` — just a different payload shape and two funding modes (D-004).

- A `KIT` need's `payload` is `{ contents, cost_per_kit, kits_needed, kits_funded, mode, upi_id? }`.
  **`kits_funded` is always server-computed**, same tamper-guard as MONEY's `raised_amount`.
  `mode` is `"MONEY"` or `"DELIVER"`, fixed once submitted. `upi_id` is **required when
  `mode: "MONEY"`** (enforced via a Zod `.refine()`, not a plain optional field) — a money-per-kit
  need still needs somewhere for the donor to actually pay; irrelevant for `"DELIVER"`.
- `POST /api/needs/:id/contributions` — same endpoint as Money, branches on `need.type`:
  - `mode: "MONEY"` contribution: `{ kits, utr, proofUrl? }` — `utr` **required**; `amount` is
    server-computed as `kits × cost_per_kit` (same audit-worthy principle as Money).
  - `mode: "DELIVER"` contribution: `{ kits, proofUrl? }` — sending a `utr` here 400s (no payment
    happens for a physical delivery pledge); `amount` stays `null`.
- Confirm/reject/override permissions are identical to Money (D-002/D-018). Confirm clamps
  `kits_funded` at `kits_needed` and advances the lifecycle the same way, just against kit counts
  instead of ₹.
- `Contribution.amount`/`.utr` are **nullable** at the schema level to support `DELIVER`-mode
  pledges — `utr` stays a DB-unique constraint (D-019) since Postgres allows multiple `NULL`s
  while still enforcing uniqueness on the values that exist.
