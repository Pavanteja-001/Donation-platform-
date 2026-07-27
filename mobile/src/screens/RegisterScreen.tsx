import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { fetchLocations, updateMe, type BloodGroup, type DistrictLocation, type Gender } from "../lib/api";
import { theme } from "../lib/theme";
import { ProgressBar } from "../components/ProgressBar";
import { Button, Input, Chip, PressableScale } from "../components/ui";

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

function formatGroup(g: BloodGroup) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

/** Groups related fields under a titled, tinted icon — the form reads as three short sections. */
function Section({
  icon,
  title,
  subtitle,
  children,
  tone = theme.color.primary,
  tint = theme.color.primarySoft,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: string;
  tint?: string;
}) {
  return (
    <View style={[styles.card, theme.elevation.level2]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: tint }]}>
          <Feather name={icon} size={15} color={tone} />
        </View>
        <View style={styles.sectionTitles}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function RegisterScreen({
  isSkippable,
  onDone,
}: {
  isSkippable: boolean;
  onDone: () => void;
}) {
  const { token, user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [dob, setDob] = useState(user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
  const [city, setCity] = useState(user?.city ?? "");
  const [area, setArea] = useState(user?.area ?? "");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(user?.bloodGroup ?? null);
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);

  const [districts, setDistricts] = useState<DistrictLocation[]>([]);

  useEffect(() => {
    fetchLocations()
      .then(({ districts }) => setDistricts(districts))
      .catch(() => {});
  }, []);

  const currentDistrictObj = districts.find((d) => d.name.toLowerCase() === city.trim().toLowerCase());
  const availableAreas = currentDistrictObj ? currentDistrictObj.areas : [];

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live completion of the six required fields (email is optional). This screen blocks posting
  // and blood response, so showing how close you are is worth the few lines.
  const completed = useMemo(
    () => [name.trim(), dob.trim(), gender, bloodGroup, city.trim(), area.trim()].filter(Boolean).length,
    [name, dob, gender, bloodGroup, city, area]
  );
  const totalRequired = 6;
  const isComplete = completed === totalRequired;

  function clearFieldError(key: string) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  const handleSave = async () => {
    if (!token) return;

    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Enter your full name";
    if (!dob.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      newErrors.dob = "Enter your date of birth as YYYY-MM-DD";
    }
    if (!gender) newErrors.gender = "Select your gender";
    if (!bloodGroup) newErrors.bloodGroup = "Select your blood group";
    if (!city.trim()) newErrors.city = "Enter your permanent city";
    if (!area.trim()) newErrors.area = "Enter your permanent area";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setError("Please fix the highlighted fields below.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await updateMe(token, {
        name: name.trim(),
        email: email.trim() || null,
        dateOfBirth: dob,
        gender: gender || undefined,
        bloodGroup: bloodGroup || undefined,
        city: city.trim(),
        area: area.trim(),
      });
      await refreshUser();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)} style={styles.intro}>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.hint}>
            India's blood-donation eligibility rules require these details before you can post a need or respond to a
            blood request.
          </Text>

          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {completed} of {totalRequired} required details
              </Text>
              {isComplete && (
                <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={styles.readyChip}>
                  <Feather name="check" size={11} color={theme.color.success} />
                  <Text style={styles.readyChipText}>Ready</Text>
                </Animated.View>
              )}
            </View>
            <ProgressBar raised={completed} target={totalRequired} showLabel={false} height={6} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(360)}>
          <Section icon="user" title="About you" subtitle="Your name as it should appear on records">
            <Input
              label="Full name"
              placeholder="Enter your full name"
              icon="user"
              value={name}
              onChangeText={(txt) => {
                setName(txt);
                clearFieldError("name");
              }}
              error={errors.name || undefined}
            />

            <Input
              label="Email address"
              placeholder="you@example.com"
              icon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              helper="Optional"
              value={email}
              onChangeText={(txt) => {
                setEmail(txt);
                clearFieldError("email");
              }}
              error={errors.email || undefined}
            />

            <Input
              label="Date of birth"
              placeholder="YYYY-MM-DD"
              icon="calendar"
              value={dob}
              onChangeText={(txt) => {
                setDob(txt);
                clearFieldError("dob");
              }}
              error={errors.dob || undefined}
            />

            <View>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.chipGrid}>
                {GENDERS.map((g) => (
                  <Chip
                    key={g.value}
                    label={g.label}
                    active={gender === g.value}
                    onPress={() => {
                      setGender(g.value);
                      clearFieldError("gender");
                    }}
                  />
                ))}
              </View>
              {errors.gender ? <FieldError message={errors.gender} /> : null}
            </View>
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(360)}>
          {/* D-010 — this is the permanent location that blood alerts are matched on, not GPS. */}
          <Section
            icon="map-pin"
            title="Permanent location"
            subtitle="Blood requests in this city will notify you"
            tone={theme.color.info}
            tint={theme.color.infoSoft}
          >
            <View>
              <Text style={styles.label}>District / City</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {districts.map((d) => (
                  <Chip
                    key={d.id}
                    label={d.name}
                    active={city.toLowerCase() === d.name.toLowerCase()}
                    onPress={() => {
                      setCity(d.name);
                      setArea("");
                      clearFieldError("city");
                    }}
                  />
                ))}
              </ScrollView>
              <Input
                label=""
                placeholder="Or type city if not listed"
                icon="map-pin"
                value={city}
                onChangeText={(txt) => {
                  setCity(txt);
                  clearFieldError("city");
                }}
                error={errors.city || undefined}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Area / Locality</Text>
              {availableAreas.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 8 }}>
                  {availableAreas.map((a) => (
                    <Chip
                      key={a}
                      label={a}
                      active={area.toLowerCase() === a.toLowerCase()}
                      onPress={() => {
                        setArea(a);
                        clearFieldError("area");
                      }}
                    />
                  ))}
                </ScrollView>
              )}
              <Input
                label=""
                placeholder="e.g. Gajuwaka, Madhurawada"
                icon="navigation"
                value={area}
                onChangeText={(txt) => {
                  setArea(txt);
                  clearFieldError("area");
                }}
                error={errors.area || undefined}
              />
            </View>
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(360)}>
          <Section
            icon="droplet"
            title="Blood group"
            subtitle="Kept private until you accept a request"
            tone={theme.color.blood}
            tint={theme.color.bloodSoft}
          >
            <View style={styles.chipGrid}>
              {BLOOD_GROUPS.map((g) => (
                <Chip
                  key={g}
                  label={formatGroup(g)}
                  tone="blood"
                  active={bloodGroup === g}
                  onPress={() => {
                    setBloodGroup(g);
                    clearFieldError("bloodGroup");
                  }}
                />
              ))}
            </View>
            {errors.bloodGroup ? <FieldError message={errors.bloodGroup} /> : null}
          </Section>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={theme.color.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <View style={styles.actions}>
          <Button label="Save & continue" icon="check" size="lg" glow onPress={handleSave} loading={isSaving} />
          {isSkippable && (
            <PressableScale onPress={onDone} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </PressableScale>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.fieldErrorRow}>
      <Feather name="alert-circle" size={12} color={theme.color.danger} />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },

  intro: { paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  hint: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  progressWrap: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
  progressLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "700" },
  readyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.color.successSoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
  },
  readyChipText: { ...theme.typography.overline, color: theme.color.success },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionIcon: { width: 32, height: 32, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center" },
  sectionTitles: { flex: 1, gap: 2 },
  sectionTitle: { ...theme.typography.h3, color: theme.color.textPrimary },
  sectionSubtitle: { ...theme.typography.caption, color: theme.color.textTertiary },
  sectionBody: { gap: theme.spacing.lg },

  label: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textPrimary, marginBottom: theme.spacing.sm },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },

  fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: theme.spacing.sm },
  fieldErrorText: { ...theme.typography.caption, color: theme.color.danger, fontWeight: "600", flex: 1 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.dangerSoft,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  errorText: { ...theme.typography.bodySmall, color: theme.color.dangerDeep, fontWeight: "600", flex: 1 },

  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  skipButton: { paddingVertical: theme.spacing.md, alignItems: "center" },
  skipText: { color: theme.color.textSecondary, fontSize: 15, fontWeight: "700" },
});
