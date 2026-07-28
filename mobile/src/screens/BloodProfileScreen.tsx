import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { updateMe, type BloodGroup, type Gender } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { useBottomInset } from "../lib/safeArea";
import { Gradient } from "../components/Gradient";
import { BloodBagIllustration } from "../components/illustrations";
import { formatBloodGroup } from "../lib/needMeta";
import { Button, Input, Chip } from "../components/ui";

const BLOOD_GROUPS: BloodGroup[] = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

// PRD §8.1 — the opt-in blood donor profile. This is the data that makes a user matchable, and
// it's sensitive health data (CLAUDE.md §7), so the screen says plainly what it's used for.
export function BloodProfileScreen({ onBack }: { onBack: () => void }) {
  const bottomInset = useBottomInset();
  const { token, user, refreshUser } = useAuth();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(user?.bloodGroup ?? null);
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [dob, setDob] = useState(user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
  const [availableToDonate, setAvailableToDonate] = useState(user?.availableToDonate ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!token) return;
    if (!bloodGroup) return setError("Select your blood group");
    if (!gender) return setError("Select a gender (used only to compute the donation gap rule)");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return setError("Enter your date of birth as YYYY-MM-DD");

    setError(null);
    setIsSaving(true);
    try {
      await updateMe(token, { bloodGroup, gender, dateOfBirth: dob, availableToDonate });
      await refreshUser();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your blood profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
          <BloodBagIllustration size={64} fillLevel={0.85} />
          <Text style={styles.title}>Blood donor profile</Text>
          <Text style={styles.subtitle}>
            This is what makes you a matchable donor. It's used only to find eligible donors for a
            request — never shown to anyone until you choose to respond.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(360)} style={[styles.card, theme.elevation.level2]}>
          <Gradient
            colors={theme.gradient.surfaceSheen}
            direction="diagonal"
            style={StyleSheet.absoluteFill as never}
            pointerEvents="none"
          />
          <View>
            <Text style={styles.label}>Blood group</Text>
            <View style={styles.chipGrid}>
              {BLOOD_GROUPS.map((g) => (
                <Chip
                  key={g}
                  label={formatBloodGroup(g)}
                  tone="blood"
                  active={bloodGroup === g}
                  onPress={() => {
                    setBloodGroup(g);
                    setError(null);
                  }}
                />
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.label}>Gender</Text>
            {/* D-005 — gender is collected strictly to apply India's donation-gap rule, so the
                screen states that rather than leaving the user to wonder why it's asked. */}
            <Text style={styles.fieldHelper}>
              Used only for India's donation-gap rule — 90 days for men, 120 days for women.
            </Text>
            <View style={styles.chipGrid}>
              {GENDERS.map((g) => (
                <Chip
                  key={g.value}
                  label={g.label}
                  active={gender === g.value}
                  onPress={() => {
                    setGender(g.value);
                    setError(null);
                  }}
                />
              ))}
            </View>
          </View>

          <Input
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            icon="calendar"
            helper="Donors must be 18 or older"
            value={dob}
            onChangeText={(txt) => {
              setDob(txt);
              setError(null);
            }}
          />

          <View style={styles.switchRow}>
            <View style={[styles.switchIcon, { backgroundColor: availableToDonate ? theme.color.bloodSoft : theme.color.surfaceMuted }]}>
              <Feather name="bell" size={15} color={availableToDonate ? theme.color.blood : theme.color.textTertiary} />
            </View>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Available to donate</Text>
              <Text style={styles.switchHint}>
                {availableToDonate
                  ? "You'll be matched to requests in your city"
                  : "Matching paused — your profile is kept"}
              </Text>
            </View>
            <Switch
              value={availableToDonate}
              onValueChange={setAvailableToDonate}
              trackColor={{ false: theme.color.border, true: theme.color.blood }}
              thumbColor={Platform.OS === "android" ? theme.color.surface : undefined}
            />
          </View>
        </Animated.View>

        {/* CLAUDE.md §7 — blood group + location is sensitive health data; the privacy promise is
            part of the UI, not just the policy. */}
        <Animated.View entering={FadeInDown.delay(120).duration(360)} style={styles.privacyBox}>
          <Feather name="lock" size={15} color={theme.color.info} />
          <Text style={styles.privacyText}>
            Your blood group and contact details stay private until you accept a request.
          </Text>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={theme.color.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <View style={styles.actions}>
          <Button label="Save blood profile" icon="check" size="lg" variant="blood" glow onPress={handleSave} loading={isSaving} />
          <Button label="Back" variant="ghost" onPress={onBack} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },

  header: { paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.bloodSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  subtitle: { ...theme.typography.bodySmall, color: theme.color.textSecondary },

  card: {
    overflow: "hidden",
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },

  label: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textPrimary },
  fieldHelper: { ...theme.typography.caption, color: theme.color.textTertiary, marginTop: 2 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },

  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  switchIcon: { width: 32, height: 32, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center" },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { ...theme.typography.bodyMedium, fontWeight: "700", color: theme.color.textPrimary },
  switchHint: { ...theme.typography.caption, color: theme.color.textSecondary },

  privacyBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.infoSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  privacyText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1, lineHeight: 17 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.dangerSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.typography.bodySmall, color: theme.color.dangerDeep, fontWeight: "600", flex: 1 },

  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
});
