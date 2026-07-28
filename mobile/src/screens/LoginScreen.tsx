import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { requestOtp, verifyOtp } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Gradient } from "../components/Gradient";
import { Button, Input, PressableScale } from "../components/ui";

type Step = "phone" | "otp";

const OTP_LENGTH = 6;

// Normalise to 10 digits — strips leading +91/91 prefix if user pastes a full number.
function normalise(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  return s.replace(/\D/g, "").slice(0, 10);
}

/**
 * Six separate cells driven by one hidden TextInput. Tapping anywhere on the row focuses the
 * real field; the cells are pure presentation. A single 6-character text box is the usual
 * shortcut here, but it gives no sense of progress while typing a code.
 */
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const caret = useSharedValue(1);

  useEffect(() => {
    if (isFocused) {
      caret.value = withRepeat(withSequence(withTiming(0, { duration: 520 }), withTiming(1, { duration: 520 })), -1, true);
    } else {
      cancelAnimation(caret);
      caret.value = 1;
    }
    return () => cancelAnimation(caret);
  }, [isFocused, caret]);

  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => {
        const char = value[i];
        const isActive = isFocused && i === Math.min(value.length, OTP_LENGTH - 1);
        return (
          <View key={i} style={[styles.otpCell, char ? styles.otpCellFilled : null, isActive && styles.otpCellActive]}>
            {char ? (
              <Text style={styles.otpChar}>{char}</Text>
            ) : isActive ? (
              <Animated.View style={[styles.caret, caretStyle]} />
            ) : null}
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(txt) => onChange(txt.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        autoFocus
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
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
      const { token, user, bloodEligibility, ...trust } = await verifyOtp("+91" + phone, code, name || undefined);
      await signIn(token, user, bloodEligibility, trust);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect or expired OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Deep crimson hero panel, mirroring the reference splash. Sits above the white form
            card so the screen reads as branded rather than blank. */}
        <Animated.View entering={FadeInUp.delay(80).duration(500)}>
          <Gradient colors={theme.gradient.heroDeep} direction="diagonal" style={[styles.hero, theme.elevation.level3]}>
            <View style={styles.brandMark}>
              <Feather name="droplet" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>DonationPlatform</Text>
            <Text style={styles.subtitle}>Connecting donors and saving lives instantly</Text>
          </Gradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(520)} style={[styles.card, theme.elevation.level2]}>
          {step === "phone" ? (
            <Animated.View key="phone-step" entering={FadeInDown.duration(300)} exiting={FadeOut.duration(180)} style={styles.stepBody}>
              <Text style={styles.cardHeader}>Welcome</Text>
              <Text style={styles.cardSubheader}>Enter your phone number and we'll send you a code</Text>

              <Input
                label="Phone number"
                placeholder="98765 43210"
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={10}
                value={phone}
                onChangeText={(txt) => {
                  setPhone(normalise(txt));
                  if (error) setError(null);
                }}
                prefix="+91"
                icon="phone"
                error={error ?? undefined}
              />

              <Button
                label="Send code"
                icon="arrow-right"
                iconPosition="right"
                size="lg"
                glow
                onPress={handleRequestOtp}
                disabled={phone.length < 10}
                loading={isSubmitting}
              />
            </Animated.View>
          ) : (
            <Animated.View key="otp-step" entering={FadeInDown.duration(300)} exiting={FadeOut.duration(180)} style={styles.stepBody}>
              <Text style={styles.cardHeader}>Verify your number</Text>
              <Text style={styles.cardSubheader}>
                We sent a 6-digit code to <Text style={styles.phoneHighlight}>+91 {phone}</Text>
              </Text>

              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (error) setError(null);
                }}
              />

              {!isRegistered && (
                <Animated.View entering={FadeInDown.duration(280)}>
                  <Input label="Full name" placeholder="Your full name" icon="user" value={name} onChangeText={setName} />
                </Animated.View>
              )}

              {/* D-015 — the static dev OTP must never reach production. Surfacing it in-app keeps
                  that fact visible to anyone testing rather than buried in a decision doc. */}
              {__DEV__ && (
                <View style={styles.devHint}>
                  <Feather name="info" size={13} color={theme.color.warning} />
                  <Text style={styles.devHintText}>Dev build — the OTP is always 123456</Text>
                </View>
              )}

              {error && (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color={theme.color.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}

              <Button
                label="Verify & continue"
                icon="check"
                size="lg"
                glow
                onPress={handleVerifyOtp}
                disabled={code.length < OTP_LENGTH}
                loading={isSubmitting}
              />

              <PressableScale
                onPress={() => {
                  setError(null);
                  setCode("");
                  setStep("phone");
                }}
                style={styles.backButton}
              >
                <Feather name="arrow-left" size={14} color={theme.color.primary} />
                <Text style={styles.backText}>Change phone number</Text>
              </PressableScale>
            </Animated.View>
          )}
        </Animated.View>

        <Text style={styles.legal}>By continuing you agree to our terms and privacy policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },

  hero: {
    alignItems: "center",
    borderRadius: theme.radii.xxl,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    overflow: "hidden",
  },
  // Glass tile on the crimson wash — a filled mark would vanish into it.
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.xl,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { ...theme.typography.h1, color: "#FFFFFF", marginBottom: theme.spacing.xs },
  subtitle: { ...theme.typography.bodySmall, color: "rgba(255,255,255,0.78)", textAlign: "center" },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xxl,
    padding: theme.spacing.xl,
  },
  stepBody: { gap: theme.spacing.lg },
  cardHeader: { ...theme.typography.h2, color: theme.color.textPrimary },
  cardSubheader: { ...theme.typography.bodySmall, color: theme.color.textSecondary, marginTop: -theme.spacing.md },
  phoneHighlight: { color: theme.color.textPrimary, fontWeight: "700" },

  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm },
  otpCell: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    backgroundColor: theme.color.background,
    alignItems: "center",
    justifyContent: "center",
  },
  otpCellFilled: { borderColor: theme.color.primary, backgroundColor: theme.color.surface },
  otpCellActive: { borderColor: theme.color.primary, backgroundColor: theme.color.surface },
  otpChar: { fontSize: 22, fontWeight: "800", color: theme.color.textPrimary },
  caret: { width: 2, height: 22, borderRadius: 1, backgroundColor: theme.color.primary },
  // Covers the cell row so taps land on the real input, but stays invisible.
  hiddenInput: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" },

  devHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.warningSoft,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  devHintText: { ...theme.typography.caption, color: "#92400E", fontWeight: "600" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.dangerSoft,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  errorText: { ...theme.typography.caption, color: theme.color.dangerDeep, fontWeight: "600", flex: 1 },

  backButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  backText: { color: theme.color.primary, fontSize: 14, fontWeight: "700" },

  legal: { ...theme.typography.caption, color: theme.color.textTertiary, textAlign: "center", marginTop: theme.spacing.xl },
});
