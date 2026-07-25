# DonationPlatform mobile

React Native, **Expo prebuild / bare workflow** (D-011) — the donor/beneficiary app (PRD §4).
Native `ios/` and `android/` projects are checked in (generated via `npx expo prebuild`); when
`app.json` changes, re-run prebuild rather than hand-editing the native projects.

## Local setup

1. `cp .env.example .env` — points the app at the local backend. On a physical device, swap
   `localhost` for your machine's LAN IP.
2. `npm install`
3. Backend running (`../backend`, see its README) with at least one seeded admin.
4. `npm run ios` / `npm run android`. (No web target — this app is iOS/Android only per D-011;
   `web-panel`/`admin` are the React web surfaces.)

## Auth flow (D-015)

`src/context/AuthContext.tsx` holds the session (JWT in `expo-secure-store`); `src/screens/LoginScreen.tsx`
is phone → OTP → `HomeScreen`. **Dev builds always accept the static OTP `123456`** — see the
dev-only warning in `backend/src/lib/otp.ts`. Mobile self-registration is always role `USER`
(donor/beneficiary — same account does both, PRD §4); `INSTITUTION` accounts register from the
web panel.

## Needs feed (PRD §6.8, Milestone 1)

`HomeScreen` is a header (greeting/role/logout) over `src/screens/NeedsFeedScreen.tsx`, which lists
`LIVE`/`PARTIALLY_FULFILLED` needs from `GET /api/needs` via `@shopify/flash-list` (CLAUDE.md's
performance rules call for FlashList over long feeds). `src/components/NeedCard.tsx` renders the
urgency badge — red is reserved for Emergency only (PRD Appendix A) — and a progress bar for
MONEY needs.

## Money flow (PRD §7, Milestone 2)

No routing library yet — `HomeScreen` switches between feed / my-needs / detail / create with
local state (`src/screens/HomeScreen.tsx`); revisit once there are enough screens to justify real
navigation.

- **Post** — the "+ Post a money need" button opens `CreateMoneyNeedScreen` (title, description,
  target amount, UPI ID). Creates + immediately submits, so it lands in the admin verification
  queue. (QR-code upload for the need itself isn't wired up yet — only the donate-proof upload
  below is; typing a UPI ID works fine without it.)
- **Track your own needs** — the "My needs" tab (`src/screens/MyNeedsScreen.tsx`) lists every need
  you posted via `GET /api/needs/mine`, any status — including `DRAFT`/`PENDING_VERIFICATION`/
  `REJECTED` ones the public feed never shows, so you can actually see a rejection reason or that
  something's still awaiting verification.
- **Donate** — tapping a `MONEY` `NeedCard` (from either tab) opens `NeedDetailScreen`. "Pay via
  UPI" builds a deep link client-side (`src/lib/upi.ts`, D-009) and opens it with
  `Linking.openURL`; the actual payment happens outside the app (D-001, no gateway). The donor
  then submits the UTR as proof — optionally attaching a payment screenshot first (see Object
  storage below) — which creates a `PENDING_CONFIRMATION` contribution.
- **Confirm** — if you're viewing a need you posted, `NeedDetailScreen` shows contributions
  awaiting your confirmation with Confirm/Reject buttons (D-002). Admin override for someone
  else's need is done from the **admin console's** Needs tab (`ADMIN`-only there too).

## Object storage (D-021)

"Attach payment screenshot (optional)" on the donate form uses `expo-image-picker` to pick a
photo, then `src/lib/api.ts`'s `signUpload` + `uploadToSignedUrl`: ask the backend for a
short-lived signed PUT URL, upload the file bytes directly to the Supabase bucket (never through
the backend), then submit the resulting public URL as `proofUrl`. Requires the
`expo-image-picker` config plugin in `app.json` (photo-library permission text) — already synced
into the native projects via `expo prebuild`.
