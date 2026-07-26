import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { postMoneyNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { Button, Input, Card } from "../components/ui";

// PRD §7.1/§7.2 — post a MONEY need. Overhauled with Reanimated and premium styling.
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
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Card elevated style={styles.card}>
          <Text style={styles.title}>Post a Money Need</Text>
          <Text style={styles.hint}>An admin verifies every helper request before it goes live.</Text>

          <Input
            label="Title"
            placeholder="E.g., Medical treatment funds"
            value={title}
            onChangeText={(txt) => {
              setTitle(txt);
              setError(null);
            }}
          />
          <Input
            label="Description"
            placeholder="Describe what this request is for"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              setError(null);
            }}
            multiline
            style={styles.multiline}
          />
          <Input
            label="Target Amount (₹)"
            placeholder="E.g., 50000"
            keyboardType="number-pad"
            value={targetAmount}
            onChangeText={(txt) => {
              setTargetAmount(txt);
              setError(null);
            }}
          />
          <Input
            label="UPI ID"
            placeholder="E.g., name@upi"
            autoCapitalize="none"
            value={upiId}
            onChangeText={(txt) => {
              setUpiId(txt);
              setError(null);
            }}
          />

          <View style={styles.pickerSection}>
            <Text style={styles.label}>Photos</Text>
            <PhotoPicker photos={photos} onChange={setPhotos} />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            label="Submit for Verification"
            onPress={handleSubmit}
            loading={isSubmitting}
          />
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
  hint: { ...theme.typography.caption, fontSize: 13, color: theme.color.textSecondary, lineHeight: 18, marginBottom: theme.spacing.xs },
  label: { fontSize: 13, fontWeight: "700", color: theme.color.textPrimary, marginBottom: theme.spacing.xs },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  pickerSection: { marginTop: theme.spacing.xs },
  errorText: { color: theme.color.danger, fontSize: 13, fontWeight: "500" },
});

