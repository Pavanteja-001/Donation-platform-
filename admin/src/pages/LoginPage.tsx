import { useState, type FormEvent } from "react";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";

type Step = "phone" | "otp";

export function LoginPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
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
      const { token, user } = await verifyOtp(phone, code);
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
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="hint" style={{ marginTop: "8px", marginBottom: "16px" }}>
              Only existing Admin/Staff accounts can log in here (D-018).
            </p>
            {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}
            <Button type="submit" label="Send OTP" disabled={!phone} loading={isSubmitting} style={{ width: "100%" }} />
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="hint" style={{ marginBottom: "16px" }}>Enter the code sent to {phone}</p>
            <Input
              label="OTP code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            {import.meta.env.DEV && (
              <p className="dev-hint" style={{ marginTop: "8px", marginBottom: "16px" }}>
                Dev build: the OTP is always 123456 (D-015).
              </p>
            )}
            {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}
            <Button type="submit" label="Verify & continue" disabled={!code} loading={isSubmitting} style={{ width: "100%" }} />
            <button
              type="button"
              className="link"
              onClick={() => setStep("phone")}
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
