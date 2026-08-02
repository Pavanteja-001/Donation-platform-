import type { NeedCategory } from "../lib/needCategory";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { postMealSlotNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatAmount, formatShortDate } from "../lib/needMeta";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold, Field } from "../components/CreateNeedScaffold";
import { Input, Chip, Button, PressableScale } from "../components/ui";

type Mode = "MONEY" | "DELIVER";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATES = 60;

// PRD §10.1/§10.2 — post a MEAL_SLOT need. Each date becomes a separately bookable MealSlot
// child entity, which is what makes this type (with BLOOD) one of the two custom modules.
export function CreateMealSlotNeedScreen({ onDone, category }: { onDone: () => void; category?: NeedCategory }) {
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
    if (dates.length >= MAX_DATES) return setError(`A meal-slot need can have at most ${MAX_DATES} dates`);
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
        category,
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

  const cost = Number(costPerSlot);
  const total = cost > 0 && dates.length > 0 ? cost * dates.length : null;

  return (
    <CreateNeedScaffold
      type="MEAL_SLOT"
      title="Sponsor meal dates"
      subtitle="Donors book specific calendar dates to sponsor or serve meals."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <Input
        label="Title"
        placeholder="e.g. Daily lunch programme at shelter home"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe who these meals will serve"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Input
        label="Meal type"
        placeholder="e.g. Lunch"
        icon="coffee"
        value={mealType}
        onChangeText={(txt) => {
          setMealType(txt);
          setError(null);
        }}
      />

      <Input
        label="Cost per slot"
        placeholder="2500"
        prefix="₹"
        keyboardType="number-pad"
        value={costPerSlot}
        onChangeText={(txt) => {
          setCostPerSlot(txt);
          setError(null);
        }}
      />

      <Field label="How can donors help?">
        <View style={styles.modeRow}>
          <Chip
            label="Sponsor a date"
            icon="credit-card"
            active={mode === "MONEY"}
            onPress={() => {
              setMode("MONEY");
              setError(null);
            }}
          />
          <Chip
            label="Cook & serve"
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
            ? "Donors pay per date via UPI directly to you."
            : "Donors pledge to cook and serve on the date they book — no app payment."}
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

      {/* Each date becomes a bookable slot (§10.2), locked on booking so two donors can't take
          the same one (§10.3/D-022). */}
      <Field label="Available dates" helper={`Add each date donors can book — up to ${MAX_DATES}`}>
        <View style={styles.dateEntryRow}>
          <View style={styles.dateInput}>
            <Input
              placeholder="2026-12-31"
              icon="calendar"
              keyboardType="numbers-and-punctuation"
              value={dateInput}
              onChangeText={(txt) => {
                setDateInput(txt);
                setError(null);
              }}
              onSubmitEditing={handleAddDate}
              returnKeyType="done"
            />
          </View>
          <Button label="Add" icon="plus" size="md" compact onPress={handleAddDate} />
        </View>

        {dates.length > 0 ? (
          <View style={styles.dateChips}>
            {dates.map((d) => (
              <Animated.View key={d} entering={ZoomIn.duration(theme.motion.fast)}>
                <PressableScale
                  onPress={() => handleRemoveDate(d)}
                  scaleTo={0.94}
                  accessibilityLabel={`Remove ${d}`}
                  style={styles.dateChip}
                >
                  <Text style={styles.dateChipText}>{formatShortDate(d)}</Text>
                  <Feather name="x" size={12} color={theme.color.textSecondary} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyDates}>
            <Feather name="calendar" size={15} color={theme.color.textTertiary} />
            <Text style={styles.emptyDatesText}>No dates added yet</Text>
          </View>
        )}

        {total !== null && (
          <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.totalBox}>
            <Feather name="bar-chart-2" size={15} color="#8A5A00" />
            <Text style={styles.totalText}>
              Total ask: <Text style={styles.totalStrong}>{formatAmount(total)}</Text> across {dates.length}{" "}
              {dates.length === 1 ? "date" : "dates"}
            </Text>
          </Animated.View>
        )}
      </Field>

      <PhotoPicker photos={photos} onChange={setPhotos} />
    </CreateNeedScaffold>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  modeHint: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: theme.spacing.sm, lineHeight: 17 },

  dateEntryRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  dateInput: { flex: 1 },
  dateChips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
  },
  dateChipText: { ...theme.typography.caption, fontWeight: "700", color: "#8A5A00" },

  emptyDates: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  emptyDatesText: { ...theme.typography.caption, color: theme.color.textTertiary },

  totalBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  totalText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
  totalStrong: { fontWeight: "800", color: theme.color.textPrimary },
});
