import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity } from "react-native";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Button, Input } from "../components/ui";

type Step = "phone" | "otp";

// Normalise to 10 digits — strips leading +91/91 prefix if user pastes a full number.
function normalise(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  return s.replace(/\D/g, "").slice(0, 10);
}


export function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp() {
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number");
      return;
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

  async function handleVerifyOtp() {
    if (code.length !== 6) {
      setError("Enter a valid 6-digit code");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user, bloodEligibility, trustTier, confirmedContributionsCount } = await verifyOtp(
        "+91" + phone,
        code,
        name || undefined
      );
      await signIn(token, user, bloodEligibility, { trustTier, confirmedContributionsCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect or expired OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>DonationPlatform</Text>
      <Text style={styles.subtitle}>
        {step === "phone" ? "Log in with your phone number" : `Enter the code sent to +91 ${phone}`}
      </Text>

      {step === "phone" ? (
        <>
          <Input
            placeholder="98765 43210"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={10}
            value={phone}
            onChangeText={(txt) => setPhone(normalise(txt))}
            prefix="+91"
          />
          <Input placeholder="Name (first time only)" value={name} onChangeText={setName} />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Send OTP" onPress={handleRequestOtp} disabled={phone.length < 10} loading={isSubmitting} />
        </>
      ) : (
        <>
          <Input placeholder="6-digit code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={(txt) => setCode(txt.replace(/\D/g, ""))} />
          {__DEV__ && <Text style={styles.devHint}>Dev build: the OTP is always 123456 (D-015).</Text>}
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Verify & continue" onPress={handleVerifyOtp} disabled={code.length < 6} loading={isSubmitting} />
          <TouchableOpacity onPress={() => setStep("phone")}>
            <Text style={styles.link}>Change phone number</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: theme.color.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  link: {
    color: theme.color.primary,
    textAlign: "center",
    marginTop: theme.spacing.lg,
    fontSize: 14,
  },
  error: {
    color: theme.color.danger,
    marginBottom: theme.spacing.md,
    fontSize: 14,
  },
  devHint: {
    color: theme.color.warning,
    fontSize: 12,
    marginBottom: theme.spacing.md,
  },
});
