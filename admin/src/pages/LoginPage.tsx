import { useState, type FormEvent } from "react";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";

type Step = "phone" | "otp";

// Normalise whatever the user types to exactly 10 digits.
// Strips leading "+91" or "91" if present, then removes non-digits.
function normalise(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  return s.replace(/\D/g, "").slice(0, 10);
}

export function LoginPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    if (phone.length !== 10) {
      return setError("Enter a valid 10-digit mobile number");
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp("+91" + phone);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) {
      return setError("Enter a valid 6-digit code");
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user } = await verifyOtp("+91" + phone, code.replace(/\D/g, ""));
      if (user.role !== "ADMIN" && user.role !== "STAFF") {
        return setError("Access denied: Only Admin and Staff accounts can log in to the Admin Console.");
      }
      signIn(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect or expired OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>DonationPlatform</h1>
        <p className="subtitle" style={{ marginBottom: "20px" }}>Admin console</p>

        {step === "phone" ? (
          <form onSubmit={handleRequestOtp}>
            <Input
              label="Phone number"
              type="tel"
              placeholder="98765 43210"
              maxLength={10}
              prefix="+91"
              value={phone}
              onChange={(e) => setPhone(normalise(e.target.value))}
              required
            />
            <p className="hint" style={{ marginTop: "8px", marginBottom: "16px" }}>
              Only existing Admin/Staff accounts can log in here (D-018).
            </p>
            {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}
            <Button type="submit" label="Send OTP" disabled={phone.length < 10} loading={isSubmitting} style={{ width: "100%" }} />
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="hint" style={{ marginBottom: "16px" }}>Enter the code sent to +91 {phone}</p>
            <Input
              label="OTP code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            {import.meta.env.DEV && (
              <p className="dev-hint" style={{ marginTop: "8px", marginBottom: "16px" }}>
                Dev build: the OTP is always 123456 (D-015).
              </p>
            )}
            {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}
            <Button type="submit" label="Verify & continue" disabled={code.length < 6} loading={isSubmitting} style={{ width: "100%" }} />
            <button
              type="button"
              className="link"
              onClick={() => { setStep("phone"); setCode(""); setError(null); }}
              style={{ marginTop: "16px", display: "block", marginLeft: "auto", marginRight: "auto" }}
            >
              Change phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
