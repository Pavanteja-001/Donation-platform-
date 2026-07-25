import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { updateMe, type BloodGroup, type Gender } from "../lib/api";
import { theme } from "../lib/theme";
import { Button, Input } from "../components/ui";

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

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!token) return;
    if (!name.trim()) return setError("Enter your full name");
    if (!dob.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return setError("Enter your date of birth as YYYY-MM-DD");
    }
    if (!gender) return setError("Select your gender");
    if (!bloodGroup) return setError("Select your blood group");
    if (!city.trim()) return setError("Enter your permanent city");
    if (!area.trim()) return setError("Enter your permanent area");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError("Enter a valid email address");
    }

    setError(null);
    setIsSaving(true);
    try {
      await updateMe(token, {
        name: name.trim(),
        email: email.trim() || null,
        dateOfBirth: dob,
        gender,
        bloodGroup,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.hint}>
        To post needs or respond to blood requests, India eligibility rules require a completed profile.
      </Text>

      <Input
        label="Full name"
        placeholder="Enter your full name"
        value={name}
        onChangeText={setName}
      />

      <Input
        label="Email address (optional)"
        placeholder="Enter your email address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Input
        label="Date of birth"
        placeholder="YYYY-MM-DD"
        value={dob}
        onChangeText={setDob}
      />

      <Input
        label="Permanent city"
        placeholder="e.g. Visakhapatnam"
        value={city}
        onChangeText={setCity}
      />

      <Input
        label="Permanent area / locality"
        placeholder="e.g. Madhurawada"
        value={area}
        onChangeText={setArea}
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.chipGrid}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.chip, gender === g.value && styles.chipActive]}
            onPress={() => setGender(g.value)}
          >
            <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Blood group</Text>
      <View style={styles.chipGrid}>
        {BLOOD_GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, bloodGroup === g && styles.chipActive]}
            onPress={() => setBloodGroup(g)}
          >
            <Text style={[styles.chipText, bloodGroup === g && styles.chipTextActive]}>
              {formatGroup(g)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        <Button label="Save & continue" onPress={handleSave} loading={isSaving} />
        {isSkippable && (
          <TouchableOpacity onPress={onDone} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 4 },
  hint: { fontSize: 14, color: theme.color.textSecondary, marginBottom: theme.spacing.lg },
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
  errorText: { color: theme.color.danger, fontSize: 13, marginBottom: theme.spacing.md },
  actions: { gap: theme.spacing.md, marginTop: theme.spacing.md, marginBottom: 40 },
  skipButton: { paddingVertical: theme.spacing.md, alignItems: "center" },
  skipText: { color: theme.color.textSecondary, fontSize: 15, fontWeight: "600" },
});
