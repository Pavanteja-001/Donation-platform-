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
  but not the buttons; the backend enforces this too, not just the UI). The progress column and
  contributions table are **kind-aware** (`Contribution.kind`) — `MONEY` shows ₹, `KIT` (PRD §9)
  shows a kit count; `amount`/`utr` are nullable now that a `DELIVER`-mode kit pledge has neither.
  `NeedDetailPage` also shows a photo gallery when the poster attached any (`Need.photos[]`,
  D-021).
- **Post a need** tab — `ADMIN`-only. For a beneficiary/partner org without their own mobile or
  web-panel account: `CreateMoneyNeedPage`/`CreateKitNeedPage` (identical forms to web-panel's,
  same `PhotoPicker`). Goes through the exact same `DRAFT → submit → PENDING_VERIFICATION`
  lifecycle as any other poster — find it afterward in the Needs tab, verify it same as anyone
  else's (including verifying your own submission — nothing stops that). Restricted to `ADMIN` in
  this UI to match D-018's existing Admin/Staff split (Staff's feature set is verify/accept +
  list users, not posting); **the backend itself has no role check on `POST /api/needs`** — a
  Staff account could still hit the API directly, this is a UI-layer scoping decision, not an
  enforced restriction (documented, verified with curl rather than assumed).
- **All users** tab — visible to both `ADMIN` and `STAFF`.
- **Staff accounts** tab — `ADMIN`-only; `STAFF` never see the tab, and the backend rejects the
  underlying `/api/admin/staff` routes for them regardless.
