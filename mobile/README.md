# DonationPlatform mobile

React Native, **Expo prebuild / bare workflow** (D-011) — the donor/beneficiary app (PRD §4).
Native `ios/` and `android/` projects are checked in (generated via `npx expo prebuild`); when
`app.json` changes, re-run prebuild rather than hand-editing the native projects.

## Local setup

1. `cp .env.example .env` — points the app at the local backend. On a physical device, swap
   `localhost` for your machine's LAN IP.
2. `npm install`
3. Backend running (`../backend`, see its README) with at least one seeded admin.
4. `npm run ios` / `npm run android` / `npm run web`.

## Auth flow (D-015)

`src/context/AuthContext.tsx` holds the session (JWT in `expo-secure-store`); `src/screens/LoginScreen.tsx`
is phone → OTP → `HomeScreen`. **Dev builds always accept the static OTP `123456`** — see the
dev-only warning in `backend/src/lib/otp.ts`. Mobile self-registration is always role `USER`
(donor/beneficiary — same account does both, PRD §4); `INSTITUTION` accounts register from the
web panel.

`HomeScreen` is a placeholder confirming auth + role load correctly — the live needs feed is
Milestone 1.
