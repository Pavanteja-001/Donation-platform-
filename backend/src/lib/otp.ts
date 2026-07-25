// Phone-OTP verification (D-015).
//
// ⚠️ DEV-ONLY: every phone number accepts the static code below, and requests are
// unlimited. This MUST be replaced with a real, rate-limited SMS OTP provider
// (e.g. MSG91, Twilio Verify) before any real users touch this — as written, it
// lets anyone log in as anyone. Never ship this to production.
const DEV_STATIC_OTP = "123456";

export function requestOtp(phone: string): void {
  // TODO(before launch): call a real SMS provider here and rate-limit per phone/IP.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[dev-otp] OTP for ${phone} is ${DEV_STATIC_OTP}`);
  }
}

export function verifyOtp(phone: string, code: string): boolean {
  // TODO(before launch): verify against the code actually sent by the provider,
  // with expiry + attempt limits, instead of a hardcoded constant.
  return code === DEV_STATIC_OTP;
}
