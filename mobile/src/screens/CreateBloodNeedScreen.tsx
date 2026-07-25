import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { postBloodNeed, uploadPhotos, type BloodGroup } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";

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

// PRD §8.3 — post a BLOOD need (group + units). No funding mode, no UPI — a respond-and-confirm
// flow, not a donate-and-confirm one (§8.5). Institution linking (D-008) isn't exposed here yet
// — see lib/api.ts's postBloodNeed comment.
export function CreateBloodNeedScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [unitsNeeded, setUnitsNeeded] = useState("1");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    const units = Number(unitsNeeded);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!bloodGroup) return setError("Select a blood group");
    if (!units || units <= 0) return setError("Enter how many units are needed");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postBloodNeed(token, {
        title: title.trim(),
        description: description.trim(),
        bloodGroup,
        unitsNeeded: units,
        photos: photoUrls,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Post a blood request</Text>
      <Text style={styles.hint}>
        An admin (or a linked hospital/blood bank) verifies this before it goes live and eligible
        donors nearby are notified (PRD §8.4).
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor={theme.color.textSecondary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Describe the situation"
        placeholderTextColor={theme.color.textSecondary}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Blood group needed</Text>
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

      <TextInput
        style={styles.input}
        placeholder="Units needed"
        placeholderTextColor={theme.color.textSecondary}
        keyboardType="number-pad"
        value={unitsNeeded}
        onChangeText={setUnitsNeeded}
      />

      <PhotoPicker photos={photos} onChange={setPhotos} />

      {error && <Text style={styles.errorText}>{error}</Text>}
      <TouchableOpacity style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={theme.color.onPrimary} /> : <Text style={styles.buttonText}>Submit for verification</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  backLink: { color: theme.color.primary, fontSize: 14, fontWeight: "600", marginBottom: theme.spacing.md },
  title: { fontSize: 20, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 4 },
  hint: { fontSize: 13, color: theme.color.textSecondary, marginBottom: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.sm },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  // Primary, not danger-red — red is reserved for urgency/emergency badges only (PRD Appendix A),
  // this is just a neutral "selected" state, not an urgency signal.
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
    marginBottom: theme.spacing.md,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
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
