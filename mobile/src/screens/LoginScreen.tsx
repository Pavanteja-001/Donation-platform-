import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";

type Step = "phone" | "otp";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp() {
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

  async function handleVerifyOtp() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user, bloodEligibility } = await verifyOtp(phone, code, name || undefined);
      await signIn(token, user, bloodEligibility);
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
        {step === "phone" ? "Log in with your phone number" : `Enter the code sent to ${phone}`}
      </Text>

      {step === "phone" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Phone number (e.g. +919876543210)"
            placeholderTextColor={theme.color.textSecondary}
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Name (first time only)"
            placeholderTextColor={theme.color.textSecondary}
            value={name}
            onChangeText={setName}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!phone || isSubmitting) && styles.buttonDisabled]}
            onPress={handleRequestOtp}
            disabled={!phone || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.color.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor={theme.color.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          {__DEV__ && <Text style={styles.devHint}>Dev build: the OTP is always 123456 (D-015).</Text>}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!code || isSubmitting) && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={!code || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.color.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Verify & continue</Text>
            )}
          </TouchableOpacity>
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
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.md,
  },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.color.onPrimary, fontSize: 16, fontWeight: "600" },
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
