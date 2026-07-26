import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { postBloodNeed, uploadPhotos, type BloodGroup } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
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

// PRD §8.3 — post a BLOOD need (group + units). Overhauled with Reanimated and premium styling.
export function CreateBloodNeedScreen({ onDone }: { onDone: () => void }) {
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
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Card elevated style={styles.card}>
          <Text style={styles.title}>Post a Blood Request</Text>
          <Text style={styles.hint}>
            An admin verifies this before it goes live and eligible donors nearby are notified.
          </Text>

          <Input
            label="Title"
            placeholder="E.g., Emergency AB+ blood needed at City Hospital"
            value={title}
            onChangeText={(txt) => {
              setTitle(txt);
              setError(null);
            }}
          />
          <Input
            label="Description"
            placeholder="Describe the situation and specify patient info if needed"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              setError(null);
            }}
            multiline
            style={styles.multiline}
          />

          <Text style={styles.label}>Blood Group Needed</Text>
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

          <Input
            label="Units Needed"
            placeholder="E.g., 2"
            keyboardType="number-pad"
            value={unitsNeeded}
            onChangeText={(txt) => {
              setUnitsNeeded(txt);
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
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  pickerSection: { marginTop: theme.spacing.xs },
  errorText: { color: theme.color.danger, fontSize: 13, fontWeight: "500" },
});
