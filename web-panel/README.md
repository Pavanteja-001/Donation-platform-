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

## Money & Kit flows (PRD §7, §9)

`DashboardPage` switches between screens with local state (no router yet, same minimal approach
as mobile) — on par with mobile for what an institution can do:

- **`MyNeedsPage`** (default) — every need this institution posted, any status, via
  `GET /api/needs/mine` (not the public feed, which only shows `LIVE`/`PARTIALLY_FULFILLED` —
  this is how you see a need still awaiting verification, or one that got rejected and why).
  "+ Money need" / "+ Kit need" open the two create screens below.
- **`CreateMoneyNeedPage`** — title/description/target/UPI + up to 5 photos.
- **`CreateKitNeedPage`** — contents/cost-per-kit/kits-needed + funding-mode picker (D-004:
  money-per-kit reveals a UPI field, buy-&-deliver doesn't) + up to 5 photos. Mirrors mobile's
  `CreateKitNeedScreen`.
- **`NeedDetailPage`** — progress bar + photo gallery + a confirm/reject panel for contributions
  awaiting this institution's confirmation (D-002). No admin-override concept here — the
  institution *is* the beneficiary for needs it posted, so it can always decide on its own
  contributions; only a third-party override (e.g. an unresponsive beneficiary) needs `ADMIN`,
  which is admin-console-only. Kind-aware (`Contribution.kind`/nullable `amount`/`utr`) so `KIT`
  contributions render correctly (kit count instead of ₹, no UTR for deliver-mode pledges).

## Object storage (D-021)

`src/lib/api.ts`'s `signUpload`/`uploadToSignedUrl`/`uploadPhotos` — same signed-URL pattern as
mobile, adapted for `File` objects instead of local URIs. `src/components/PhotoPicker.tsx` (HTML
file input, multi-select up to 5, thumbnail grid with remove) is used on both create pages,
folder `"need-photos"`.
