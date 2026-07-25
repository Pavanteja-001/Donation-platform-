# CLAUDE.md — Project Context (read this first, every session)

> **This file is read automatically by Claude Code at the start of every session.**
> It is the project's permanent memory. The chat forgets between sessions; this file does not.
> Keep it accurate. When something important changes, update it here.

---

## 0. How to work on this project (read carefully)

1. At the start of every session, read in this order:
   `CLAUDE.md` → `docs/PRD.md` → `TASKS.md` → `PROGRESS.md` → `docs/DECISIONS.md`
2. Pick up from the **next unchecked task** in `TASKS.md`.
3. Do **one task per chunk**. Do not start work that can't be finished and documented before credits may run out.
4. **Before we stop each session**, update `PROGRESS.md` (what was done, what's next) and check off completed items in `TASKS.md`.
5. Any product/architecture decision → record it in `docs/DECISIONS.md` (what changed, why, alternatives, impact).
6. Never lose context in the chat — write it to a file.

**Resume prompt (paste this at the start of a new session):**
```
Read CLAUDE.md, docs/PRD.md, TASKS.md, and PROGRESS.md to load full context.
Then continue from the next unchecked task in TASKS.md.
When you finish: check it off, and before we stop, update PROGRESS.md.
```

---

## 1. What this project is

**Name:** DonationPlatform *(confirmed)*

A donation + community-support platform for India. The public posts a **need**, an admin
verifies it, donors fulfill it, and both sides confirm. It covers many kinds of giving —
money, blood, grocery/education kits, unused goods, orphanage meal slots — plus a
volunteering and Q&A community layer.

**Region:** India (Andhra Pradesh first). Design choices assume Indian donors, UPI, and
Indian blood-donation rules.

---

## 2. The three surfaces ("total three")

1. **Donor / Beneficiary Mobile App** (iOS + Android) — the public. Both *donate* and *post needs* here.
2. **Institution Web Panel** — NGOs, hospitals, blood banks, orphanages register, post requests, and donate.
3. **Admin Console (web)** — verifies/approves everything, manages users & institutions, oversees the platform.

---

## 3. The core architectural principle (the whole thing rests on this)

Almost everything is **one object: a `Need` with a `type`**, running **one lifecycle**:

```
post → PENDING_VERIFICATION → LIVE → (PARTIALLY_FULFILLED) → FULFILLED
                                                       ↘ REJECTED / EXPIRED
```

Need types: `MONEY`, `BLOOD`, `KIT`, `GOODS`, `MEAL_SLOT`, `SKILL_REQUEST`, `QUESTION`.

Build **one engine** that handles the shared lifecycle, then add **type-specific logic**.
Only **two** types break the common pattern and need custom modules:
- **BLOOD** — real-time, eligibility-aware, geo-matched notifications.
- **MEAL_SLOT** — calendar/slot booking with locking (no double-booking).

Everything else is the same engine with different fields. This is why the project is
achievable instead of being five separate apps.

---

## 4. Roles

- **Donor** — browses live needs, donates, uploads proof, earns trust tier + certificates.
- **Beneficiary** — posts a need; **confirms receipt** of a donation.
- **Institution** — NGO / hospital / blood bank / orphanage; posts requests, can also donate.
- **Admin** — verifies needs, approves/overrides donation confirmations, manages the platform.
- **Volunteer** *(phase-2 role, exists in model)* — scribe, career mentor.

---

## 5. Locked decisions (see docs/DECISIONS.md for full reasoning)

- **Payments (v1):** No gateway yet. Beneficiary shows **UPI ID / QR**; donor pays them
  **directly**; donor uploads **screenshot / UTR**. Gateway (Razorpay/Cashfree) is a later upgrade —
  design money records so they can graduate to it cleanly.
- **Donation confirmation:** **Beneficiary confirms** receipt; **admin can override**.
- **Progress visibility:** Every money need shows a public progress bar (raised ÷ target).
- **Kits:** Support **both** modes — donor gives money per kit *or* buys & delivers the kit.
- **Blood:** Match on group + location **+ eligibility** (last-donation date, India gap rules) + an
  "available to donate" toggle. Design so it *could* connect to eRaktKosh later (not v1).
- **Certificates:** Platform **records / thank-yous**, NOT official medical or govt certificates,
  unless a hospital/blood bank actually issues them. Word them accordingly.
- **v1 scope:** All flows are in scope; the **build order** in `TASKS.md` sequences them.
- **Institution onboarding (KYC):** NGOs/hospitals/blood banks/orphanages upload identity docs at
  registration (name, reg. no, Darpan ID *where applicable*, certificate PDF/JPEG, address, bank
  account, photos) and are **admin-verified** before they can post. Required fields **depend on
  institution type** — Darpan ID is for NGOs; hospitals/blood banks use their own licence. See D-007.
- **Blood verification (institution-assisted):** a blood need can be **linked to a hospital/blood
  bank** that can **verify it**, fast-tracking time-critical cases; admin also verifies. The need shows
  on the beneficiary's mobile side **and** the institution's web panel. See D-008.
- **Live status sync:** status is **one source of truth in the backend**, pushed **in real time to
  every panel** (mobile, institution, admin). All surfaces subscribe; no stale views. See D-008.
- **Location & blood notifications (v1):** capture the donor's **permanent location** (city + area) at
  registration — **this is the basis for notifications; no real-time GPS.** v1 blood alerts go to **all
  eligible donors whose permanent location is in the request's city** (no radius/SOS yet). The donor
  **sees the exact donation location** (hospital/pickup) once approved/engaged; an individual's exact
  address stays private until then. See D-010.
- **Adopted enhancements:** UPI deep-link, tri-language (Telugu/Hindi/English), and WhatsApp for
  urgent blood + sharing are **committed for v1** (moved from IDEAS). See D-009.
- **Urgency & completion:** needs have Normal / Urgent / **Emergency** levels (**admin-verified, not
  self-declared**); Emergency is pinned in the feed until fulfilled + notifies eligible donors. Needs
  auto-close at 100% → **Completed** section (public impact wall); unfunded past deadline → EXPIRED.
  See D-012 / D-013.
- **One theme, one backend:** all three surfaces share a **single design system** (PRD Appendix A)
  and a **single backend/API** — consistent theme + data everywhere, no per-surface styling. See D-014.
  Red is reserved for danger/emergency/blood only. Open gaps to resolve during build: O-5…O-10 in
  DECISIONS.md (auth, notification fallback, disputes, admin roles, UTR limit, legal).
- **Auth / notifications / roles / UTR:** phone **OTP** (static `123456` in dev — **must be replaced +
  rate-limited before launch**, D-015); **Expo push** with a high-priority channel for Emergency +
  **WhatsApp** sharing (D-016); rejections need a **mandatory reason** shown live to the poster (D-017);
  admin panel has **Admin + Staff** roles — staff can verify/accept + list all users but not edit
  users/settings or override (D-018); **UTR must be unique** — no duplicate uploads (D-019).

---

## 6. Tech stack (CONFIRMED)

- **Mobile app:** React Native with **Expo (prebuild / bare workflow)** — one codebase, iOS + Android.
- **Web panels (Institution + Admin):** React.
- **Backend:** Node.js (Express or NestJS), deployed on **Railway**.
- **Database:** **PostgreSQL** (on Railway).
- **Image storage:** object-storage **bucket** (Cloudflare R2 or Supabase Storage) served via **CDN**.
  Never store images in Postgres or on the app server.
- **Real-time:** WebSockets — for the live status sync (D-008).
- **Push notifications:** **Expo push** (delivered via FCM/APNs); high-priority channel for Emergency (D-016).
- **Payments:** UPI **deep-link** (`upi://pay?...`, amount pre-filled) + QR now → Razorpay/Cashfree later.
- **Languages:** Telugu + Hindi + English — **i18n from day one**.

**Performance rules (this app must feel instant — see D-011):** `expo-image` (cached), **FlashList**
for long feeds, backend-generated **WebP thumbnails** (never send full-res to a list), pagination,
skeleton loaders, optimistic UI.

---

## 7. Sensitive-data & trust rules (do not skip)

- Blood group + location = **sensitive health data**. Require explicit consent; don't expose a
  donor's details to a hospital without it.
- Money never touches the platform in v1, so verification is human (screenshot + beneficiary
  confirmation). Treat all money records as **audit-worthy**: keep UTR, amount, timestamps,
  who confirmed. This is what lets a real gateway take over later.
- Never imply a platform certificate is an official/medical/government document.
- **Static OTP (`123456`) is dev-only.** It MUST be replaced with a real, rate-limited OTP provider
  before any real users — it currently lets anyone log in as anyone. Never ship it to production.
