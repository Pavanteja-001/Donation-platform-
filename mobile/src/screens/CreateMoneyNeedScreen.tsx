import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { postMoneyNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";

// PRD §7.1/§7.2 — post a MONEY need (target + UPI + optional photos, D-021).
export function CreateMoneyNeedScreen({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    const amount = Number(targetAmount);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!amount || amount <= 0) return setError("Enter a valid target amount");
    if (!upiId.trim()) return setError("Enter your UPI ID");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postMoneyNeed(token, {
        title: title.trim(),
        description: description.trim(),
        targetAmount: amount,
        upiId: upiId.trim(),
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
      <Text style={styles.title}>Post a money need</Text>
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
        placeholder="Target amount (₹)"
        placeholderTextColor={theme.color.textSecondary}
        keyboardType="number-pad"
        value={targetAmount}
        onChangeText={setTargetAmount}
      />
      <TextInput
        style={styles.input}
        placeholder="Your UPI ID"
        placeholderTextColor={theme.color.textSecondary}
        autoCapitalize="none"
        value={upiId}
        onChangeText={setUpiId}
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
  title: { fontSize: 20, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 4 },
  hint: { fontSize: 13, color: theme.color.textSecondary, marginBottom: theme.spacing.lg },
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

