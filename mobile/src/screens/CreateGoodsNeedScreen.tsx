import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { postGoodsNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { Button, Input, Card } from "../components/ui";

// PRD §11.1/§11.2 — post a GOODS need. Overhauled with Reanimated and premium styling.
export function CreateGoodsNeedScreen({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [item, setItem] = useState("");
  const [condition, setCondition] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!item.trim()) return setError("Describe the item you need");
    if (!condition.trim()) return setError("Describe an acceptable condition (e.g. new, gently used)");

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postGoodsNeed(token, {
        title: title.trim(),
        description: description.trim(),
        item: item.trim(),
        condition: condition.trim(),
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
          <Text style={styles.title}>Post a Goods Need</Text>
          <Text style={styles.hint}>An admin verifies every helper request before it goes live.</Text>

          <Input
            label="Title"
            placeholder="E.g., Wheelchair needed for senior citizen center"
            value={title}
            onChangeText={(txt) => {
              setTitle(txt);
              setError(null);
            }}
          />
          <Input
            label="Description"
            placeholder="Describe what this item will be used for"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              setError(null);
            }}
            multiline
            style={styles.multiline}
          />
          <Input
            label="Item Required"
            placeholder="E.g., Manual wheelchair (adult size)"
            value={item}
            onChangeText={(txt) => {
              setItem(txt);
              setError(null);
            }}
          />
          <Input
            label="Acceptable Condition"
            placeholder="E.g., New or gently used"
            value={condition}
            onChangeText={(txt) => {
              setCondition(txt);
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
