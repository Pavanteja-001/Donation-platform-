import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { postKitNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { Button, Input, Chip, Card } from "../components/ui";

type Mode = "MONEY" | "DELIVER";

// PRD §9.1/§9.2 — post a KIT need. Overhauled with Reanimated and premium styling.
export function CreateKitNeedScreen({ onDone }: { onDone: () => void }) {
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
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Card elevated style={styles.card}>
          <Text style={styles.title}>Post a Kit Need</Text>
          <Text style={styles.hint}>An admin verifies every helper request before it goes live.</Text>

          <Input
            label="Title"
            placeholder="E.g., Relief kits for flood-affected families"
            value={title}
            onChangeText={(txt) => {
              setTitle(txt);
              setError(null);
            }}
          />
          <Input
            label="Description"
            placeholder="Describe what these kits are needed for"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              setError(null);
            }}
            multiline
            style={styles.multiline}
          />
          <Input
            label="Kit Contents"
            placeholder="E.g., 5kg rice, 2kg dal, 1L cooking oil, 2 soaps"
            value={contents}
            onChangeText={(txt) => {
              setContents(txt);
              setError(null);
            }}
          />
          <Input
            label="Cost per Kit (₹)"
            placeholder="E.g., 500"
            keyboardType="number-pad"
            value={costPerKit}
            onChangeText={(txt) => {
              setCostPerKit(txt);
              setError(null);
            }}
          />
          <Input
            label="Kits Needed"
            placeholder="E.g., 100"
            keyboardType="number-pad"
            value={kitsNeeded}
            onChangeText={(txt) => {
              setKitsNeeded(txt);
              setError(null);
            }}
          />

          <Text style={styles.label}>How can donors help?</Text>
          <View style={styles.modeRow}>
            <Chip
              label="Fund a kit (money)"
              active={mode === "MONEY"}
              onPress={() => {
                setMode("MONEY");
                setError(null);
              }}
            />
            <Chip
              label="Buy & deliver"
              active={mode === "DELIVER"}
              onPress={() => {
                setMode("DELIVER");
                setError(null);
              }}
            />
          </View>
          <Text style={styles.fieldHint}>
            {mode === "MONEY"
              ? "Donors pay per kit via UPI directly to you, same as a money request."
              : "Donors pledge to buy and physically deliver kits themselves — no app payment."}
          </Text>

          {mode === "MONEY" && (
            <Input
              label="Your UPI ID"
              placeholder="E.g., name@upi"
              autoCapitalize="none"
              value={upiId}
              onChangeText={(txt) => {
                setUpiId(txt);
                setError(null);
              }}
            />
          )}

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
  fieldHint: { fontSize: 12, color: theme.color.textSecondary, lineHeight: 16, marginBottom: theme.spacing.sm },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  pickerSection: { marginTop: theme.spacing.xs },
  errorText: { color: theme.color.danger, fontSize: 13, fontWeight: "500" },
});
