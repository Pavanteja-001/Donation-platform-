import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Button, Input, Card } from "../components/ui";

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
  const [isRegistered, setIsRegistered] = useState(true);
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
      const res = await requestOtp("+91" + phone);
      setIsRegistered(res.registered);
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
    if (!isRegistered && !name.trim()) {
      setError("Please enter your name to register");
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
      <View style={styles.innerContainer}>
        {/* Top Logo Section with FadeInUp */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <Feather name="droplet" size={32} color={theme.color.primary} />
          </View>
          <Text style={styles.title}>DonationPlatform</Text>
          <Text style={styles.subtitle}>Connecting donors and saving lives instantly</Text>
        </Animated.View>

        {/* Input Card Container with FadeInDown */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Card elevated style={styles.card}>
            {step === "phone" ? (
              <Animated.View
                key="phone-step"
                entering={FadeInDown.duration(300)}
                exiting={FadeOut.duration(200)}
              >
                <Text style={styles.cardHeader}>Log In / Register</Text>
                <Text style={styles.cardSubheader}>Enter your phone number to get started</Text>

                <Input
                  label="Phone Number"
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={10}
                  value={phone}
                  onChangeText={(txt) => setPhone(normalise(txt))}
                  prefix="+91"
                />

                {error && <Text style={styles.error}>{error}</Text>}

                <Button
                  label="Send OTP"
                  onPress={handleRequestOtp}
                  disabled={phone.length < 10}
                  loading={isSubmitting}
                />
              </Animated.View>
            ) : (
              <Animated.View
                key="otp-step"
                entering={FadeInDown.duration(300)}
                exiting={FadeOut.duration(200)}
              >
                <Text style={styles.cardHeader}>Verify OTP</Text>
                <Text style={styles.cardSubheader}>Enter the 6-digit code sent to +91 {phone}</Text>

                <Input
                  label="OTP Code"
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={(txt) => setCode(txt.replace(/\D/g, ""))}
                />

                {!isRegistered && (
                  <Input
                    label="Full Name"
                    placeholder="Your Full Name"
                    value={name}
                    onChangeText={setName}
                  />
                )}

                {__DEV__ && (
                  <View style={styles.devHintContainer}>
                    <Feather name="info" size={14} color={theme.color.warning} />
                    <Text style={styles.devHint}>Dev build: OTP is always 123456</Text>
                  </View>
                )}

                {error && <Text style={styles.error}>{error}</Text>}

                <Button
                  label="Verify & Continue"
                  onPress={handleVerifyOtp}
                  disabled={code.length < 6}
                  loading={isSubmitting}
                />

                <TouchableOpacity onPress={() => { setError(null); setStep("phone"); }} style={styles.backButton}>
                  <Feather name="arrow-left" size={14} color={theme.color.primary} />
                  <Text style={styles.backText}>Change phone number</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Card>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  innerContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.color.primary + "12", // 7% opacity primary color
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h1,
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.color.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    padding: theme.spacing.xl,
    borderRadius: theme.radius * 1.5,
    backgroundColor: theme.color.surface,
  },
  cardHeader: {
    ...theme.typography.h2,
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  cardSubheader: {
    ...theme.typography.caption,
    fontSize: 13,
    color: theme.color.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  error: {
    color: theme.color.danger,
    marginBottom: theme.spacing.md,
    fontSize: 14,
  },
  devHintContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.color.warning + "12",
    padding: theme.spacing.sm,
    borderRadius: theme.radius / 2,
    marginBottom: theme.spacing.md,
  },
  devHint: {
    color: "#B27A00",
    fontSize: 12,
    fontWeight: "500",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  backText: {
    color: theme.color.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
