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

- **Post** — the "+ Money need" button opens `CreateMoneyNeedScreen` (title, description, target
  amount, UPI ID, up to 5 photos via `PhotoPicker`). Creates + immediately submits, so it lands
  in the admin verification queue. (QR-code upload specifically isn't wired — general photos are;
  typing a UPI ID works fine either way.)
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

Two independent uses of the same signed-upload mechanism (`src/lib/api.ts`'s `signUpload` +
`uploadToSignedUrl`, folder-namespaced in the bucket):

- **Donation proof** — "Attach payment screenshot (optional)" on the donate form, a single
  photo, folder `"contribution-proofs"`, submitted as `Contribution.proofUrl`.
- **Need photos** — `src/components/PhotoPicker.tsx` (multi-select up to 5, thumbnail grid with
  remove) on both `CreateMoneyNeedScreen` and `CreateKitNeedScreen`, folder `"need-photos"`,
  submitted as `Need.photos[]`. `lib/api.ts`'s `uploadPhotos()` signs+uploads each file in
  sequence. Displayed via **`expo-image`** (cached) — `NeedCard`'s cover photo, `NeedDetailScreen`'s
  photo gallery.

Requires the `expo-image-picker` config plugin in `app.json` (photo-library permission text) and
`expo-image`'s plugin — both already synced into the native projects via `expo prebuild`.

## Kit flow (PRD §9, Milestone 3)

Same shape as Money, plus a funding-mode branch (D-004):

- **Post** — "+ Kit need" opens `CreateKitNeedScreen` (contents, cost/kit, kits needed, and a
  mode picker). Picking `MONEY` reveals a UPI ID field — a money-per-kit need still needs
  somewhere to receive payment, same as a Money need (a gap caught mid-build and fixed at the
  schema level, see `docs/DECISIONS.md`/PROGRESS.md Session 14). `DELIVER` mode has no such field.
- **Progress** — `NeedCard`/`NeedDetailScreen` show kit progress via the same `ProgressBar`
  component as Money, using its `label` override ("`X of Y kits funded`" instead of a ₹ amount).
- **Donate** — `NeedDetailScreen` has a *second*, independent donate section for `KIT` needs
  (money needs and kit needs are never the same need, so only one of the two ever renders):
  mode-aware — `MONEY` mode looks just like the Money donate form (UPI deep-link, UTR, optional
  screenshot) but denominated in kit count; `DELIVER` mode has no UPI/UTR at all, just a kit-count
  pledge with an optional delivery photo. Both create a `PENDING_CONFIRMATION` contribution the
  same way.
- **Confirm** — same confirm/reject panel as Money, kind-aware (shows "`N kits`" instead of "`₹N`"
  and "No payment — delivery pledge" instead of a UTR when there isn't one).
