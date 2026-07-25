import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { updateMe, type BloodGroup, type Gender } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";

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

// PRD §8.1 — opt-in blood donor profile. Sensitive health data (CLAUDE.md §7); this is the only
// place it's edited, and filling it in is what "becoming a blood donor" means.
export function BloodProfileScreen({ onBack }: { onBack: () => void }) {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Blood donor profile</Text>
      <Text style={styles.hint}>
        Filling this in is what makes you a matchable blood donor (PRD §8.1). We only use it to
        find eligible donors nearby — never shown to anyone until you respond to a request.
      </Text>

      <Text style={styles.label}>Blood group</Text>
      <View style={styles.chipGrid}>
        {BLOOD_GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, bloodGroup === g && styles.chipActive]}
            onPress={() => setBloodGroup(g)}
          >
            <Text style={[styles.chipText, bloodGroup === g && styles.chipTextActive]}>{formatGroup(g)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Gender</Text>
      <Text style={styles.hint}>Only used to compute the India donation-gap rule (90 days men / 120 days women).</Text>
      <View style={styles.chipGrid}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.chip, gender === g.value && styles.chipActive]}
            onPress={() => setGender(g.value)}
          >
            <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Date of birth</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.color.textSecondary}
        value={dob}
        onChangeText={setDob}
      />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Available to donate</Text>
          <Text style={styles.hint}>Turn off to pause without deleting your profile.</Text>
        </View>
        <Switch value={availableToDonate} onValueChange={setAvailableToDonate} />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      <TouchableOpacity style={[styles.button, isSaving && styles.buttonDisabled]} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color={theme.color.onPrimary} /> : <Text style={styles.buttonText}>Save</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  backLink: { color: theme.color.primary, fontSize: 14, fontWeight: "600", marginBottom: theme.spacing.md },
  title: { fontSize: 20, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 4 },
  hint: { fontSize: 13, color: theme.color.textSecondary, marginBottom: theme.spacing.md },
  label: { fontSize: 13, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.sm },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipActive: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.color.textSecondary },
  chipTextActive: { color: theme.color.onPrimary },
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.lg },
  errorText: { color: theme.color.danger, fontSize: 13, marginBottom: theme.spacing.md },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.color.onPrimary, fontSize: 16, fontWeight: "600" },
});
