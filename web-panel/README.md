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

KYC onboarding (D-007) and request posting are later milestones; `DashboardPage` is a placeholder
confirming institution auth + role loading end-to-end.
