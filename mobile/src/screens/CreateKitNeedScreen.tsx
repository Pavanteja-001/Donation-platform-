import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { postKitNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";

type Mode = "MONEY" | "DELIVER";

// PRD §9.1/§9.2 — post a KIT need (contents, cost/kit, kits needed, funding mode). Reuses the
// same admin-verification flow as Money (PRD §6.3).
export function CreateKitNeedScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contents, setContents] = useState("");
  const [costPerKit, setCostPerKit] = useState("");
  const [kitsNeeded, setKitsNeeded] = useState("");
  const [mode, setMode] = useState<Mode>("MONEY");
  const [upiId, setUpiId] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    const cost = Number(costPerKit);
    const kits = Number(kitsNeeded);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!contents.trim()) return setError("Describe what's in one kit");
    if (!cost || cost <= 0) return setError("Enter a valid cost per kit");
    if (!kits || kits <= 0) return setError("Enter how many kits are needed");
    if (mode === "MONEY" && !upiId.trim()) return setError("Enter your UPI ID — donors pay per kit through it");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postKitNeed(token, {
        title: title.trim(),
        description: description.trim(),
        contents: contents.trim(),
        costPerKit: cost,
        kitsNeeded: kits,
        mode,
        upiId: mode === "MONEY" ? upiId.trim() : undefined,
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
      <Text style={styles.title}>Post a kit need</Text>
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
        placeholder="What's in one kit (e.g. rice, dal, oil, soap)"
        placeholderTextColor={theme.color.textSecondary}
        value={contents}
        onChangeText={setContents}
      />
      <TextInput
        style={styles.input}
        placeholder="Cost per kit (₹)"
        placeholderTextColor={theme.color.textSecondary}
        keyboardType="number-pad"
        value={costPerKit}
        onChangeText={setCostPerKit}
      />
      <TextInput
        style={styles.input}
        placeholder="Kits needed"
        placeholderTextColor={theme.color.textSecondary}
        keyboardType="number-pad"
        value={kitsNeeded}
        onChangeText={setKitsNeeded}
      />

      <Text style={styles.label}>How can donors help?</Text>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeOption, mode === "MONEY" && styles.modeOptionActive]}
          onPress={() => setMode("MONEY")}
        >
          <Text style={[styles.modeOptionText, mode === "MONEY" && styles.modeOptionTextActive]}>
            Fund a kit (money)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeOption, mode === "DELIVER" && styles.modeOptionActive]}
          onPress={() => setMode("DELIVER")}
        >
          <Text style={[styles.modeOptionText, mode === "DELIVER" && styles.modeOptionTextActive]}>
            Buy & deliver
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        {mode === "MONEY"
          ? "Donors pay per kit via UPI, same as a money need."
          : "Donors pledge to buy and physically deliver kits themselves — no payment through the app."}
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
