import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "../context/AuthContext";
import { fetchLocations, updateMe, type AreaLocation, type BloodGroup, type DistrictLocation, type Gender } from "../lib/api";
import { getCurrentGpsLocation } from "../lib/locationUtils";
import { theme } from "../lib/theme";
import { useBottomInset } from "../lib/safeArea";
import { Gradient } from "../components/Gradient";
import { IconPlate, litRamp } from "../components/Depth";
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
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />
      <View style={styles.sectionHeader}>
        {/* Lit plate instead of a flat tinted square — registration is the first real screen a
            donor fills in, so it should feel like the rest of the app rather than a web form. */}
        <IconPlate icon={icon} size="sm" tone="custom" colors={litRamp(tone)} />
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
  const bottomInset = useBottomInset();
  const { token, user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [dob, setDob] = useState(user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [city, setCity] = useState(user?.city ?? "");
  const [area, setArea] = useState(user?.area ?? "");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(user?.bloodGroup ?? null);
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);

  const [districts, setDistricts] = useState<DistrictLocation[]>([]);
  const [showDistrictSelector, setShowDistrictSelector] = useState(false);
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchLocations()
      .then(({ districts: fetched }) => {
        if (fetched && fetched.length > 0) setDistricts(fetched);
      })
      .catch(() => {});
  }, []);

  const selectedDistrictObj = districts.find((d) => d.name.toLowerCase() === city.trim().toLowerCase());
  const availableAreas: AreaLocation[] = selectedDistrictObj ? selectedDistrictObj.areas : [];

  function clearFieldError(field: string) {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleSelectDistrict(district: DistrictLocation) {
    setCity(district.name);
    setArea("");
    setShowDistrictSelector(false);
    clearFieldError("city");
  }

  function handleSelectArea(areaItem: string | AreaLocation) {
    const areaName = typeof areaItem === "string" ? areaItem : areaItem.name;
    setArea(areaName);
    setShowAreaSelector(false);
    clearFieldError("area");
  }

  const completionPercent = useMemo(() => {
    let filled = 0;
    const total = 6;
    if (name.trim()) filled++;
    if (email.trim()) filled++;
    if (dob.trim()) filled++;
    if (gender) filled++;
    if (city.trim()) filled++;
    if (bloodGroup) filled++;
    return Math.round((filled / total) * 100);
  }, [name, email, dob, gender, city, bloodGroup]);

  async function handleGpsDetect() {
    setIsFetchingGps(true);
    try {
      const loc = await getCurrentGpsLocation();
      if (loc && loc.city) {
        setCity(loc.city);
        clearFieldError("city");
      }
    } catch (e) {
      // Best effort
    } finally {
      setIsFetchingGps(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (dob.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
        next.dob = "Select a valid Date of Birth";
      } else {
        const parsed = new Date(dob.trim());
        if (isNaN(parsed.getTime())) {
          next.dob = "Date does not exist";
        } else {
          const age = new Date().getFullYear() - parsed.getFullYear();
          if (age < 18 || age > 65) {
            next.dob = `Age ${age} is outside the 18–65 donor range (PRD §8.2)`;
          }
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!token) return;
    if (!validate()) return;

    setError(null);
    setIsSaving(true);
    try {
      await updateMe(token, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        dateOfBirth: dob.trim() ? new Date(dob.trim()).toISOString() : undefined,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        bloodGroup: bloodGroup ?? undefined,
        gender: gender ?? undefined,
      });
      await refreshUser();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(360)} style={styles.intro}>
          <Text style={styles.title}>Your donor profile</Text>
          <Text style={styles.hint}>
            Help us match you with blood requests in your area. Everything below is optional and can be updated anytime.
          </Text>

          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Profile completion</Text>
              <View style={styles.readyChip}>
                <Feather name="check-circle" size={12} color={theme.color.success} />
                <Text style={styles.readyChipText}>{completionPercent}% ready</Text>
              </View>
            </View>
            <ProgressBar raised={completionPercent} target={100} height={6} tone="blood" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(360)}>
          <Section icon="user" title="Personal details" subtitle="Visible to organizers when you donate">
            <Input
              label="Full name"
              placeholder="e.g. Priya Sharma"
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

            <View>
              <Text style={styles.label}>Date of birth</Text>
              <TouchableOpacity
                style={[
                  styles.dobPickerButton,
                  errors.dob ? styles.dobPickerError : null,
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Feather name="calendar" size={16} color={theme.color.primary} />
                <Text style={dob ? styles.dobText : styles.dobPlaceholder}>
                  {dob ? dob : "Select Date of Birth"}
                </Text>
              </TouchableOpacity>
              {errors.dob ? <FieldError message={errors.dob} /> : null}

              {showDatePicker && (
                <DateTimePicker
                  value={dob ? new Date(dob) : new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  minimumDate={new Date(1930, 0, 1)}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selectedDate) {
                      const yyyy = selectedDate.getFullYear();
                      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                      const dd = String(selectedDate.getDate()).padStart(2, "0");
                      setDob(`${yyyy}-${mm}-${dd}`);
                      clearFieldError("dob");
                    }
                  }}
                />
              )}
            </View>

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
            {/* District / City Select Dropdown */}
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.label}>District / City</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => {
                  setShowDistrictSelector(!showDistrictSelector);
                  setShowAreaSelector(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownLeft}>
                  <Feather name="map-pin" size={16} color={theme.color.primary} />
                  <Text style={styles.dropdownText}>{city || "Select District / City"}</Text>
                </View>
                <Feather name={showDistrictSelector ? "chevron-up" : "chevron-down"} size={20} color={theme.color.primary} />
              </TouchableOpacity>

              {showDistrictSelector && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {districts.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.dropdownItem, city.toLowerCase() === d.name.toLowerCase() && styles.dropdownItemActive]}
                        onPress={() => handleSelectDistrict(d)}
                      >
                        <Feather
                          name={city.toLowerCase() === d.name.toLowerCase() ? "check-circle" : "circle"}
                          size={15}
                          color={city.toLowerCase() === d.name.toLowerCase() ? theme.color.primary : "#94A3B8"}
                        />
                        <Text style={[styles.itemText, city.toLowerCase() === d.name.toLowerCase() && styles.itemTextActive]}>
                          {d.name} ({d.state})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {errors.city ? <FieldError message={errors.city} /> : null}
            </View>

            {/* Area / Locality Select Dropdown */}
            <View>
              <Text style={styles.label}>Area / Locality</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => {
                  setShowAreaSelector(!showAreaSelector);
                  setShowDistrictSelector(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownLeft}>
                  <Feather name="navigation" size={16} color={theme.color.primary} />
                  <Text style={styles.dropdownText}>{area || "Select Area / Locality"}</Text>
                </View>
                <Feather name={showAreaSelector ? "chevron-up" : "chevron-down"} size={20} color={theme.color.primary} />
              </TouchableOpacity>

              {showAreaSelector && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {availableAreas.length > 0 ? (
                      availableAreas.map((a) => {
                        const areaName = typeof a === "string" ? a : a.name;
                        const isSelected = area.toLowerCase() === areaName.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={areaName}
                            style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                            onPress={() => handleSelectArea(a)}
                          >
                            <Feather
                              name={isSelected ? "check-circle" : "circle"}
                              size={15}
                              color={isSelected ? theme.color.primary : "#94A3B8"}
                            />
                            <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>
                              {areaName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={{ padding: 12, color: theme.color.textSecondary, fontSize: 13 }}>
                        Select a district first
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}
              {errors.area ? <FieldError message={errors.area} /> : null}
            </View>

            <Button
              label={isFetchingGps ? "Detecting Location…" : "📍 Auto-detect My Location via GPS"}
              variant="secondary"
              size="sm"
              onPress={handleGpsDetect}
              disabled={isFetchingGps}
              style={{ marginTop: 12 }}
            />
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
    <View style={styles.fieldErrorRow}>
      <Feather name="alert-circle" size={12} color={theme.color.danger} />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.background },
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
    overflow: "hidden",
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

  dobPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  dobPickerError: {
    borderColor: theme.color.danger,
  },
  dobText: {
    ...theme.typography.body,
    color: theme.color.textPrimary,
    fontWeight: "600",
  },
  dobPlaceholder: {
    ...theme.typography.bodySmall,
    color: theme.color.textTertiary,
  },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemActive: {
    backgroundColor: "#FFF1F2",
  },
  itemText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
  },
  itemTextActive: {
    color: theme.color.primary,
    fontWeight: "700",
  },

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
