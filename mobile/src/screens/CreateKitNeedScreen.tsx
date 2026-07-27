import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { postKitNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatAmount } from "../lib/needMeta";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold, Field } from "../components/CreateNeedScaffold";
import { Input, Chip } from "../components/ui";

type Mode = "MONEY" | "DELIVER";

// PRD §9.1/§9.2 — post a KIT need. D-004: both modes are supported — donors either fund a kit
// or buy and deliver it themselves.
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

  // Shown live so the poster can sanity-check the ask before an admin has to.
  const cost = Number(costPerKit);
  const kits = Number(kitsNeeded);
  const total = cost > 0 && kits > 0 ? cost * kits : null;

  return (
    <CreateNeedScaffold
      type="KIT"
      title="Request kits"
      subtitle="Grocery or education kits, either funded by donors or delivered by them."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <Input
        label="Title"
        placeholder="e.g. Relief kits for flood-affected families"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe what these kits are needed for"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Input
        label="Kit contents"
        placeholder="e.g. 5kg rice, 2kg dal, 1L oil, 2 soaps"
        icon="package"
        helper="What one kit contains"
        value={contents}
        onChangeText={(txt) => {
          setContents(txt);
          setError(null);
        }}
      />

      <Input
        label="Cost per kit"
        placeholder="500"
        prefix="₹"
        keyboardType="number-pad"
        value={costPerKit}
        onChangeText={(txt) => {
          setCostPerKit(txt);
          setError(null);
        }}
      />

      <Input
        label="Kits needed"
        placeholder="100"
        icon="hash"
        keyboardType="number-pad"
        value={kitsNeeded}
        onChangeText={(txt) => {
          setKitsNeeded(txt);
          setError(null);
        }}
      />

      {total !== null && (
        <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.totalBox}>
          <Feather name="bar-chart-2" size={15} color={theme.color.primary} />
          <Text style={styles.totalText}>
            Total ask: <Text style={styles.totalStrong}>{formatAmount(total)}</Text> for {kits} kits
          </Text>
        </Animated.View>
      )}

      <Field label="How can donors help?" helper="D-004 — you can accept either, or both over time">
        <View style={styles.modeRow}>
          <Chip
            label="Fund a kit"
            icon="credit-card"
            active={mode === "MONEY"}
            onPress={() => {
              setMode("MONEY");
              setError(null);
            }}
          />
          <Chip
            label="Buy & deliver"
            icon="truck"
            active={mode === "DELIVER"}
            onPress={() => {
              setMode("DELIVER");
              setError(null);
            }}
          />
        </View>
        <Text style={styles.modeHint}>
          {mode === "MONEY"
            ? "Donors pay per kit via UPI directly to you, same as a money request."
            : "Donors pledge to buy and physically deliver kits themselves — no app payment."}
        </Text>
      </Field>

      {mode === "MONEY" && (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)}>
          <Input
            label="Your UPI ID"
            placeholder="name@upi"
            icon="credit-card"
            helper="Donors pay this directly — double-check it"
            autoCapitalize="none"
            value={upiId}
            onChangeText={(txt) => {
              setUpiId(txt);
              setError(null);
            }}
          />
        </Animated.View>
      )}

      <PhotoPicker photos={photos} onChange={setPhotos} />
    </CreateNeedScaffold>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  modeHint: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: theme.spacing.sm, lineHeight: 17 },
  totalBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  totalText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
  totalStrong: { fontWeight: "800", color: theme.color.textPrimary },
});
