import { useState, type FormEvent } from "react";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Step = "phone" | "otp";

export function LoginPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user } = await verifyOtp(phone, code, name || undefined);
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
        <p className="subtitle">Institution partner panel</p>

        {step === "phone" ? (
          <form onSubmit={handleRequestOtp}>
            <label>
              Phone number
              <input
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <label>
              Institution contact name
              <input
                type="text"
                placeholder="First time only"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={!phone || isSubmitting}>
              {isSubmitting ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="hint">Enter the code sent to {phone}</p>
            <label>
              OTP code
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            {import.meta.env.DEV && <p className="dev-hint">Dev build: the OTP is always 123456 (D-015).</p>}
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={!code || isSubmitting}>
              {isSubmitting ? "Verifying…" : "Verify & continue"}
            </button>
            <button type="button" className="link" onClick={() => setStep("phone")}>
              Change phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
