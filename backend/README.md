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

Need verify/accept endpoints land in Milestone 1 alongside the `Need` model, gated the same way
(`requireRole(Role.ADMIN, Role.STAFF)`).
