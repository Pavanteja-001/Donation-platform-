import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { postMealSlotNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { Button, Input, Chip, Card } from "../components/ui";

type Mode = "MONEY" | "DELIVER";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// PRD §10.1/§10.2 — post a MEAL_SLOT need. Overhauled with Reanimated and premium styling.
export function CreateMealSlotNeedScreen({ onDone }: { onDone: () => void }) {
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
      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        <Card elevated style={styles.card}>
          <Text style={styles.title}>Post a Meal Slot Need</Text>
          <Text style={styles.hint}>An admin verifies every helper request before it goes live.</Text>

          <Input
            label="Title"
            placeholder="E.g., Daily lunch program at shelter home"
            value={title}
            onChangeText={(txt) => {
              setTitle(txt);
              setError(null);
            }}
          />
          <Input
            label="Description"
            placeholder="Describe who these meals will serve"
            value={description}
            onChangeText={(txt) => {
              setDescription(txt);
              setError(null);
            }}
            multiline
            style={styles.multiline}
          />
          <Input
            label="Meal Type"
            placeholder="E.g., Lunch, Breakfast, Dinner"
            value={mealType}
            onChangeText={(txt) => {
              setMealType(txt);
              setError(null);
            }}
          />
          <Input
            label="Cost per Slot (₹)"
            placeholder="E.g., 2500"
            keyboardType="number-pad"
            value={costPerSlot}
            onChangeText={(txt) => {
              setCostPerSlot(txt);
              setError(null);
            }}
          />

          <Text style={styles.label}>How can donors help?</Text>
          <View style={styles.modeRow}>
            <Chip
              label="Fund a slot (money)"
              active={mode === "MONEY"}
              onPress={() => {
                setMode("MONEY");
                setError(null);
              }}
            />
            <Chip
              label="Cook & serve in person"
              active={mode === "DELIVER"}
              onPress={() => {
                setMode("DELIVER");
                setError(null);
              }}
            />
          </View>
          <Text style={styles.fieldHint}>
            {mode === "MONEY"
              ? "Donors pay per slot via UPI directly to you, same as a money request."
              : "Donors pledge to personally cook/serve that date — no app payment."}
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

          <Text style={styles.label}>Bookable Dates</Text>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="YYYY-MM-DD"
                value={dateInput}
                onChangeText={(txt) => {
                  setDateInput(txt);
                  setError(null);
                }}
              />
            </View>
            <View style={{ marginTop: 2 }}>
              <Button label="Add" variant="secondary" onPress={handleAddDate} />
            </View>
          </View>

          {dates.length > 0 && (
            <View style={styles.dateChipRow}>
              {dates.map((d) => (
                <Chip
                  key={d}
                  label={`${d} ✕`}
                  active
                  onPress={() => handleRemoveDate(d)}
                />
              ))}
            </View>
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
  dateRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-start" },
  dateChipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  pickerSection: { marginTop: theme.spacing.xs },
  errorText: { color: theme.color.danger, fontSize: 13, fontWeight: "500" },
});
