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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      setError("Please fix the validation errors below.");
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.hint}>
        To post needs or respond to blood requests, India eligibility rules require a completed profile.
      </Text>

      <Input
        label="Full name"
        placeholder="Enter your full name"
        value={name}
        onChangeText={(txt) => {
          setName(txt);
          if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
        }}
        error={errors.name}
      />

      <Input
        label="Email address (optional)"
        placeholder="Enter your email address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(txt) => {
          setEmail(txt);
          if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
        }}
        error={errors.email}
      />

      <Input
        label="Date of birth"
        placeholder="YYYY-MM-DD"
        value={dob}
        onChangeText={(txt) => {
          setDob(txt);
          if (errors.dob) setErrors((prev) => ({ ...prev, dob: "" }));
        }}
        error={errors.dob}
      />

      <Input
        label="Permanent city"
        placeholder="e.g. Visakhapatnam"
        value={city}
        onChangeText={(txt) => {
          setCity(txt);
          if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
        }}
        error={errors.city}
      />

      <Input
        label="Permanent area / locality"
        placeholder="e.g. Madhurawada"
        value={area}
        onChangeText={(txt) => {
          setArea(txt);
          if (errors.area) setErrors((prev) => ({ ...prev, area: "" }));
        }}
        error={errors.area}
      />

      <Text style={styles.label}>Gender</Text>
      <View style={[styles.chipGrid, errors.gender ? { marginBottom: theme.spacing.xs } : null]}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.chip, gender === g.value && styles.chipActive]}
            onPress={() => {
              setGender(g.value);
              if (errors.gender) setErrors((prev) => ({ ...prev, gender: "" }));
            }}
          >
            <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.gender ? <Text style={styles.fieldError}>{errors.gender}</Text> : null}

      <Text style={styles.label}>Blood group</Text>
      <View style={[styles.chipGrid, errors.bloodGroup ? { marginBottom: theme.spacing.xs } : null]}>
        {BLOOD_GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, bloodGroup === g && styles.chipActive]}
            onPress={() => {
              setBloodGroup(g);
              if (errors.bloodGroup) setErrors((prev) => ({ ...prev, bloodGroup: "" }));
            }}
          >
            <Text style={[styles.chipText, bloodGroup === g && styles.chipTextActive]}>
              {formatGroup(g)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.bloodGroup ? <Text style={styles.fieldError}>{errors.bloodGroup}</Text> : null}

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
  errorText: { color: theme.color.danger, fontSize: 13, marginTop: theme.spacing.md, marginBottom: theme.spacing.md },
  fieldError: { color: theme.color.danger, fontSize: 12, marginTop: 0, marginBottom: theme.spacing.md },
  actions: { gap: theme.spacing.md, marginTop: theme.spacing.md, marginBottom: 40 },
  skipButton: { paddingVertical: theme.spacing.md, alignItems: "center" },
  skipText: { color: theme.color.textSecondary, fontSize: 15, fontWeight: "600" },
});
