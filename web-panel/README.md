# DonationPlatform web-panel

React (Vite + TypeScript) — the institution partner panel (NGO / hospital / blood bank /
orphanage, PRD §4, §16).

## Local setup

1. `cp .env.example .env`
2. `npm install`
3. Backend running (`../backend`).
4. `npm run dev`

## Auth (D-015)

Phone → OTP → dashboard, same pattern as `mobile/`. Self-registration through this panel is
always role `INSTITUTION` (`src/lib/api.ts`). **Dev builds always accept the static OTP `123456`**
— see the dev-only warning in `backend/src/lib/otp.ts`.

KYC onboarding (D-007) is not built yet — an institution account can post/manage needs immediately
after OTP login, same as a mobile `USER` account.

## Money flow (PRD §7)

`DashboardPage` switches between three screens with local state (no router yet, same minimal
approach as mobile):

- **`MyNeedsPage`** (default) — every need this institution posted, any status, via
  `GET /api/needs/mine` (not the public feed, which only shows `LIVE`/`PARTIALLY_FULFILLED` —
  this is how you see a need still awaiting verification, or one that got rejected and why).
- **`CreateMoneyNeedPage`** — title/description/target/UPI, creates + auto-submits for
  verification. QR/proof-doc upload deferred — no object-storage pipeline yet.
- **`NeedDetailPage`** — progress bar + a confirm/reject panel for contributions awaiting this
  institution's confirmation (D-002). No admin-override concept here — the institution *is* the
  beneficiary for needs it posted, so it can always decide on its own contributions; only a
  third-party override (e.g. an unresponsive beneficiary) needs `ADMIN`, which is admin-console-only.
