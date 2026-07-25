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
- `GET /api/needs/:id` — owner, Admin/Staff, or anyone once it's publicly visible (`LIVE`+);
  404s otherwise (doesn't leak existence of private/rejected needs).
- `GET /api/admin/needs` — the verification queue (`PENDING_VERIFICATION`), Admin + Staff.
- `POST /api/admin/needs/:id/verify` — Admin + Staff, `PENDING_VERIFICATION → LIVE`.
- `POST /api/admin/needs/:id/reject { reason }` — Admin + Staff; `reason` is mandatory (D-017) and
  shown to the poster via `GET /api/needs/:id`.

Type-specific fields (target amount/UPI for `MONEY`, blood group/units for `BLOOD`, …) live in the
untyped `payload` JSON column for now — validated per type as each flow gets built (Milestone 2+).
