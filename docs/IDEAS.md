# IDEAS.md — Enhancement Backlog (India-first)

> Ideas worth doing, kept separate from committed decisions. When one is adopted, move it to
> DECISIONS.md as a D-entry and add tasks to TASKS.md. Nothing here is committed yet.
> "Verify" notes mark things whose regulatory/technical specifics should be confirmed before building.

---

## ✅ Adopted for v1 (now committed — see DECISIONS D-009 / D-010 / D-011)
- UPI deep-link · Telugu/Hindi/English (i18n) · WhatsApp for urgent blood + sharing (D-009)
- Privacy-first location: city+area at registration, city-scoped blood alerts in v1 (D-010)
- Performance rules: expo-image, FlashList, WebP thumbnails, bucket+CDN (D-011)

## High-leverage (recommend for v1 or early)

- **UPI deep-link, not just QR.** *(ADOPTED — D-009)* Generate a `upi://pay?pa=<vpa>&pn=<name>&am=<amount>&tn=<note>`
  intent link so tapping opens GPay/PhonePe/Paytm with the amount pre-filled. Fewer wrong-amount
  errors, faster donations, cleaner UTR capture. Directly upgrades the money flow (D-001).

- **Privacy-first location sharing.** People: show approximate area (locality/pin-code) + distance,
  never exact home address. Blood: show the **hospital** location (public/safe), not the patient's.
  Reveal precise details only after a match + consent. Add a map + "near me" feed sorted by
  distance × urgency, with a radius filter.

- **Multi-language (Telugu / Hindi / English).** Andhra-first → Telugu UI is a big reach + trust win.
  Build i18n from day one; retrofitting is painful.

- **WhatsApp integration.** A "share this need" button + WhatsApp alerts for emergency blood.
  India runs on WhatsApp; this out-reaches in-app push. *(Verify WhatsApp Business API terms/costs.)*

- **Blood "SOS" with escalating radius.** One-tap emergency broadcast to eligible donors within
  ~5 km; if unmatched in X minutes, auto-widen to 10 km, then 15 km.

- **Fraud guards for the manual-money model.** Flag the same UTR reused across donations, or one
  bank account attached to many needs. Cheap; protects the platform's core asset (trust).

## Medium-term

- **Impact wall / transparency feed.** Public list of fulfilled needs (what was needed → what was
  given → confirmed). Transparency drives repeat giving.

- **Low-data / patchy-network mode.** Compressed images, offline caching, lightweight lists.

- **Recurring / scheduled giving** and **round-up** donations.

- **Clean records for future 80G receipts.** Even before implementing 80G, store donation data so
  receipts are trivial to generate later. *(Verify 80G eligibility/requirements with the NGO's status.)*

## Later / needs care

- **Phone-OTP verification as the trust baseline** for beneficiaries; consider stronger identity
  signals cautiously. *(Aadhaar has strict legal handling — verify before going anywhere near it.)*

- **eRaktKosh integration** for blood inventory/national linkage. *(Verify API availability.)*
