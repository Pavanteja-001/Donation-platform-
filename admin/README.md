# DonationPlatform admin

React (Vite + TypeScript) — the admin console (PRD §4, §15).

## Local setup

1. `cp .env.example .env`
2. `npm install`
3. Backend running (`../backend`), with at least one seeded admin
   (`npm run prisma:seed` in `backend/`, default phone `+910000000000`).
4. `npm run dev`

## Auth & RBAC (D-015, D-018)

Phone → OTP → console. **Admin/Staff accounts are never self-registered here** — the login form
has no name/role fields; only phone numbers that already exist as `ADMIN` or `STAFF` on the
backend can get in (`src/context/AuthContext.tsx` rejects any other role client-side, and every
`/api/admin/*` route enforces it server-side too). **Dev builds always accept the static OTP
`123456`** — see the dev-only warning in `backend/src/lib/otp.ts`.

- **Needs** tab (default) — visible to both `ADMIN` and `STAFF`. Filter chips switch between the
  verification queue (`PENDING_VERIFICATION`, the default) and other statuses via
  `GET /api/admin/needs?status=...`. Clicking a need opens `NeedDetailPage`: Verify/Reject
  (D-017's mandatory reason is a `window.prompt`) for `ADMIN`+`STAFF`, plus a contributions table
  whose Confirm/Reject override buttons are **`ADMIN`-only** (D-002/D-018 — `STAFF` sees the table
  but not the buttons; the backend enforces this too, not just the UI).
- **All users** tab — visible to both `ADMIN` and `STAFF`.
- **Staff accounts** tab — `ADMIN`-only; `STAFF` never see the tab, and the backend rejects the
  underlying `/api/admin/staff` routes for them regardless.
