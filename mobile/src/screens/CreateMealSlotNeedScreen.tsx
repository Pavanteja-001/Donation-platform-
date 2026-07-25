import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { postMealSlotNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";

type Mode = "MONEY" | "DELIVER";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// PRD §10.1/§10.2 — post a MEAL_SLOT need (meal type, cost/slot, funding mode, and the bookable
// calendar dates). No date-picker dependency yet — plain "YYYY-MM-DD" text entry, added one at a
// time into a chip list, same "don't add a dependency until it's needed" call as elsewhere in
// this app (e.g. no routing library).
export function CreateMealSlotNeedScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState("");
  const [costPerSlot, setCostPerSlot] = useState("");
  const [mode, setMode] = useState<Mode>("MONEY");
  const [upiId, setUpiId] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAddDate() {
    const d = dateInput.trim();
    if (!DATE_RE.test(d)) return setError("Enter a date as YYYY-MM-DD");
    if (dates.includes(d)) return setError("That date is already in the list");
    if (dates.length >= 60) return setError("A meal-slot need can have at most 60 dates");
    setError(null);
    setDates((prev) => [...prev, d].sort());
    setDateInput("");
  }

  function handleRemoveDate(d: string) {
    setDates((prev) => prev.filter((x) => x !== d));
  }

  async function handleSubmit() {
    if (!token) return;
    const cost = Number(costPerSlot);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!mealType.trim()) return setError("Describe the meal (e.g. breakfast, lunch)");
    if (!cost || cost <= 0) return setError("Enter a valid cost per slot");
    if (mode === "MONEY" && !upiId.trim()) return setError("Enter your UPI ID — donors pay per slot through it");
    if (dates.length === 0) return setError("Add at least one date");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postMealSlotNeed(token, {
        title: title.trim(),
        description: description.trim(),
        mealType: mealType.trim(),
        costPerSlot: cost,
        mode,
        upiId: mode === "MONEY" ? upiId.trim() : undefined,
        dates,
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
      <Text style={styles.title}>Post a meal-slot need</Text>
      <Text style={styles.hint}>An admin verifies every need before it goes live (PRD §6.3).</Text>

      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor={theme.color.textSecondary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Describe what this is for"
        placeholderTextColor={theme.color.textSecondary}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="Meal (e.g. breakfast, lunch, dinner)"
        placeholderTextColor={theme.color.textSecondary}
        value={mealType}
        onChangeText={setMealType}
      />
      <TextInput
        style={styles.input}
        placeholder="Cost per slot (₹)"
        placeholderTextColor={theme.color.textSecondary}
        keyboardType="number-pad"
        value={costPerSlot}
        onChangeText={setCostPerSlot}
      />

      <Text style={styles.label}>How can donors help?</Text>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeOption, mode === "MONEY" && styles.modeOptionActive]}
          onPress={() => setMode("MONEY")}
        >
          <Text style={[styles.modeOptionText, mode === "MONEY" && styles.modeOptionTextActive]}>
            Fund a slot (money)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeOption, mode === "DELIVER" && styles.modeOptionActive]}
          onPress={() => setMode("DELIVER")}
        >
          <Text style={[styles.modeOptionText, mode === "DELIVER" && styles.modeOptionTextActive]}>
            Cook & serve in person
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        {mode === "MONEY"
          ? "Donors pay per slot via UPI, same as a money need."
          : "Donors pledge to personally cook/serve that date — no payment through the app."}
      </Text>

      {mode === "MONEY" && (
        <TextInput
          style={styles.input}
          placeholder="Your UPI ID"
          placeholderTextColor={theme.color.textSecondary}
          autoCapitalize="none"
          value={upiId}
          onChangeText={setUpiId}
        />
      )}

      <Text style={styles.label}>Bookable dates</Text>
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.input, styles.dateInput]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.color.textSecondary}
          value={dateInput}
          onChangeText={setDateInput}
        />
        <TouchableOpacity style={styles.addDateButton} onPress={handleAddDate}>
          <Text style={styles.addDateButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
      {dates.length > 0 && (
        <View style={styles.dateChipRow}>
          {dates.map((d) => (
            <TouchableOpacity key={d} style={styles.dateChip} onPress={() => handleRemoveDate(d)}>
              <Text style={styles.dateChipText}>{d} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
  modeRow: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  modeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  modeOptionActive: { borderColor: theme.color.primary, backgroundColor: theme.color.primary },
  modeOptionText: { fontSize: 13, fontWeight: "600", color: theme.color.textSecondary },
  modeOptionTextActive: { color: theme.color.onPrimary },
  dateRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-start" },
  dateInput: { flex: 1 },
  addDateButton: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  addDateButtonText: { color: theme.color.onPrimary, fontSize: 14, fontWeight: "600" },
  dateChipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  dateChip: {
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  dateChipText: { color: theme.color.primary, fontSize: 13, fontWeight: "600" },
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
