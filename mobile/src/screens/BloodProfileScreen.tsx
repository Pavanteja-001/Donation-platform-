import { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { updateMe, type BloodGroup, type Gender } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Button, Input, Chip, Card } from "../components/ui";

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

// PRD §8.1 — opt-in blood donor profile. Overhauled with Reanimated and premium styling.
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
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Card elevated style={styles.card}>
          <Text style={styles.title}>Blood Donor Profile</Text>
          <Text style={styles.hint}>
            Filling this in is what makes you a matchable blood donor. We only use it to
            find eligible donors nearby — never shown to anyone until you respond to a request.
          </Text>

          <Text style={styles.label}>Blood Group</Text>
          <View style={styles.chipGrid}>
            {BLOOD_GROUPS.map((g) => (
              <Chip
                key={g}
                label={formatGroup(g)}
                active={bloodGroup === g}
                onPress={() => {
                  setBloodGroup(g);
                  setError(null);
                }}
              />
            ))}
          </View>

          <Text style={styles.label}>Gender</Text>
          <Text style={styles.fieldHint}>Only used to compute the India donation-gap rule (90 days men / 120 days women).</Text>
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

          <Input
            label="Date of Birth"
            placeholder="YYYY-MM-DD"
            value={dob}
            onChangeText={(txt) => {
              setDob(txt);
              setError(null);
            }}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
              <Text style={styles.switchLabel}>Available to Donate</Text>
              <Text style={styles.switchHint}>Turn off to pause matching without deleting your profile.</Text>
            </View>
            <Switch
              value={availableToDonate}
              onValueChange={setAvailableToDonate}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              thumbColor={Platform.OS === "android" ? theme.color.surface : undefined}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.actions}>
            <Button label="Save Blood Profile" onPress={handleSave} loading={isSaving} />
            <Button label="Back" variant="secondary" onPress={onBack} />
          </View>
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  card: { padding: theme.spacing.xl, gap: theme.spacing.md },
  title: { ...theme.typography.h1, color: theme.color.textPrimary, marginBottom: 4 },
  hint: { ...theme.typography.caption, fontSize: 13, color: theme.color.textSecondary, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "700", color: theme.color.textPrimary, marginTop: theme.spacing.xs },
  fieldHint: { fontSize: 12, color: theme.color.textSecondary, lineHeight: 16, marginBottom: theme.spacing.sm },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  switchRow: { flexDirection: "row", alignItems: "center", marginVertical: theme.spacing.sm },
  switchLabel: { fontSize: 15, fontWeight: "700", color: theme.color.textPrimary },
  switchHint: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2, lineHeight: 16, fontWeight: "500" },
  errorText: { color: theme.color.danger, fontSize: 13, fontWeight: "500" },
  actions: { gap: theme.spacing.md, marginTop: theme.spacing.md },
});
