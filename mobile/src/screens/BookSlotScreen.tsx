import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { bookSlot, fetchAvailability, type MealType, type Orphanage, type TakenSlot } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Gradient } from "../components/Gradient";
import { IconPlate, litRamp } from "../components/Depth";
import { Button, Chip, Input, PressableScale, Skeleton } from "../components/ui";
import { SuccessCelebration } from "../components/SuccessCelebration";
import type { IconName } from "../lib/needMeta";

const MEALS: { type: MealType; label: string; icon: IconName; time: string; color: string }[] = [
  { type: "BREAKFAST", label: "Breakfast", icon: "sunrise", time: "Morning", color: "#E8A317" },
  { type: "LUNCH", label: "Lunch", icon: "sun", time: "Afternoon", color: "#B91C1C" },
  { type: "DINNER", label: "Dinner", icon: "moon", time: "Evening", color: "#4C1D95" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Common occasions, so most donors never have to type. */
const PURPOSES = ["Birthday", "Anniversary", "In memory", "Festival", "Just because"];

/** `YYYY-MM-DD` in LOCAL time — `toISOString()` would shift the day for anyone east of UTC. */
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return toKey(a) === toKey(b);
}

export function BookSlotScreen({ home, onDone }: { home: Orphanage; onDone: () => void }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const today = useMemo(startOfToday, []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [purpose, setPurpose] = useState<string>(PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState("");
  const [people, setPeople] = useState("");

  const [taken, setTaken] = useState<TakenSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const loadAvailability = useCallback(async () => {
    if (!token) return;
    try {
      const { taken: slots } = await fetchAvailability(token, home.id);
      setTaken(slots);
    } catch {
      // Not fatal — the server's unique constraint is the real guard, so a failed read just means
      // the calendar looks open and a genuine clash is caught on submit.
      setTaken([]);
    }
  }, [token, home.id]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const offered = useMemo(
    () =>
      MEALS.map((m) => ({
        ...m,
        cost: m.type === "BREAKFAST" ? home.breakfastCost : m.type === "LUNCH" ? home.lunchCost : home.dinnerCost,
      })).filter((m) => m.cost != null),
    [home]
  );

  const takenKeys = useMemo(() => new Set((taken ?? []).map((t) => `${t.date}|${t.mealType}`)), [taken]);
  const isMealTaken = useCallback((date: Date, meal: MealType) => takenKeys.has(`${toKey(date)}|${meal}`), [takenKeys]);
  const isDayFull = useCallback(
    (date: Date) => offered.length > 0 && offered.every((m) => isMealTaken(date, m.type)),
    [offered, isMealTaken]
  );
  const isPast = useCallback((date: Date) => date < today, [today]);

  /** Calendar grid: leading blanks so the 1st lands under its weekday, then the month's days. */
  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    return cells;
  }, [month]);

  // Paging back before the current month is pointless — nothing there is bookable.
  const canGoBack = month > new Date(today.getFullYear(), today.getMonth(), 1);

  // Clear a meal that becomes unavailable when the date changes, so the CTA can't submit a
  // combination the donor can no longer see selected.
  useEffect(() => {
    if (mealType && isMealTaken(selectedDate, mealType)) setMealType(null);
  }, [selectedDate, mealType, isMealTaken]);

  const selected = offered.find((m) => m.type === mealType);
  const resolvedPurpose = purpose === "Other" ? customPurpose.trim() : purpose;
  const canSubmit = !!mealType && !isPast(selectedDate) && !isSubmitting;

  async function handleBook() {
    if (!token || !mealType) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await bookSlot(token, home.id, {
        date: toKey(selectedDate),
        mealType,
        purpose: resolvedPurpose || undefined,
        peopleCount: people.trim() ? Number(people) : undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete the booking");
      // Someone may have taken it while this screen was open — refresh so the calendar matches
      // reality instead of leaving an option visible that no longer exists.
      loadAvailability();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <SuccessCelebration
        visible
        title="Sponsorship requested"
        message={`${home.name ?? "The home"} will confirm your ${selected?.label.toLowerCase() ?? "meal"} on ${selectedDate.toDateString()}. You'll be notified either way.`}
        actionLabel="Done"
        onDismiss={onDone}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Who you're sponsoring, kept in view — the previous screen's context shouldn't vanish
            the moment the donor starts picking dates. */}
        <Animated.View entering={FadeInDown.duration(320)}>
          <Gradient colors={theme.gradient.heroDeep} direction="diagonal" style={styles.hero}>
            <Text style={styles.heroLabel}>Sponsoring a meal at</Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {home.name ?? home.legalName ?? "this home"}
            </Text>
            {home.childrenCount != null && (
              <View style={styles.heroMeta}>
                <Feather name="users" size={12} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroMetaText}>Feeds {home.childrenCount} residents</Text>
              </View>
            )}
          </Gradient>
        </Animated.View>

        {/* --- Date ------------------------------------------------------------------------ */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={styles.card}>
          <Gradient
            colors={theme.gradient.surfaceSheen}
            direction="diagonal"
            style={StyleSheet.absoluteFill as never}
            pointerEvents="none"
          />

          <View style={styles.monthHeader}>
            <PressableScale
              onPress={() => canGoBack && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              disabled={!canGoBack}
              scaleTo={0.9}
              hitSlop={10}
              accessibilityLabel="Previous month"
              style={[styles.monthNav, !canGoBack && styles.monthNavDisabled]}
            >
              <Feather name="chevron-left" size={20} color={canGoBack ? theme.color.primary : theme.color.textTertiary} />
            </PressableScale>

            <Text style={styles.monthLabel}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>

            <PressableScale
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              scaleTo={0.9}
              hitSlop={10}
              accessibilityLabel="Next month"
              style={styles.monthNav}
            >
              <Feather name="chevron-right" size={20} color={theme.color.primary} />
            </PressableScale>
          </View>

          <View style={styles.weekHeader}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          {/* A whole month at once. With dates getting blocked, a week-at-a-time strip means
              paging repeatedly just to find an open day. */}
          <View style={styles.grid}>
            {grid.map((d, i) => {
              if (!d) return <View key={`blank-${i}`} style={styles.dayCell} />;
              const past = isPast(d);
              const full = isDayFull(d);
              const disabled = past || full;
              const active = sameDay(d, selectedDate);
              const isToday = sameDay(d, today);
              return (
                <PressableScale
                  key={toKey(d)}
                  onPress={() => !disabled && setSelectedDate(d)}
                  disabled={disabled}
                  scaleTo={0.9}
                  accessibilityLabel={`${d.toDateString()}${full ? ", fully booked" : ""}`}
                  style={styles.dayCell}
                >
                  <View style={[styles.day, active && styles.dayActive, disabled && styles.dayDisabled]}>
                    <Text
                      style={[
                        styles.dayNumber,
                        active && styles.dayNumberActive,
                        disabled && styles.dayNumberDisabled,
                        isToday && !active && styles.dayNumberToday,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  {/* A fully-booked day carries a dot and nothing more — who booked it and why is
                      never revealed to another donor. */}
                  {full && !past && <View style={styles.fullDot} />}
                </PressableScale>
              );
            })}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendSwatch} />
              <Text style={styles.legendText}>Selected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Fully booked</Text>
            </View>
          </View>
        </Animated.View>

        {/* --- Meal ------------------------------------------------------------------------ */}
        <Text style={styles.sectionTitle}>Choose a meal</Text>
        {taken === null ? (
          <View style={styles.mealList}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={72} radius={theme.radii.lg} />
            ))}
          </View>
        ) : (
          <View style={styles.mealList}>
            {offered.map((m) => {
              const unavailable = isMealTaken(selectedDate, m.type);
              const active = mealType === m.type;
              return (
                <PressableScale
                  key={m.type}
                  onPress={() => !unavailable && setMealType(m.type)}
                  disabled={unavailable}
                  scaleTo={0.985}
                  accessibilityLabel={`${m.label}${unavailable ? ", already sponsored" : ""}`}
                  style={[styles.mealRow, active && styles.mealRowActive, unavailable && styles.mealRowTaken]}
                >
                  {/* Full-width rows rather than three cramped tiles: each meal now has room for
                      its time of day and price without truncating. */}
                  <IconPlate icon={m.icon} size="md" tone="custom" colors={litRamp(m.color)} />

                  <View style={styles.mealText}>
                    <Text style={[styles.mealName, unavailable && styles.mealTextMuted]}>{m.label}</Text>
                    <Text style={[styles.mealTime, unavailable && styles.mealTextMuted]}>
                      {unavailable ? "Already sponsored" : m.time}
                    </Text>
                  </View>

                  <Text style={[styles.mealCost, active && styles.mealCostActive, unavailable && styles.mealTextMuted]}>
                    ₹{m.cost!.toLocaleString("en-IN")}
                  </Text>

                  <Feather
                    name={active ? "check-circle" : unavailable ? "slash" : "circle"}
                    size={20}
                    color={active ? theme.color.primary : theme.color.textTertiary}
                  />
                </PressableScale>
              );
            })}
          </View>
        )}

        {/* --- Occasion -------------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>Occasion</Text>
        <Text style={styles.sectionHint}>Optional — it helps the home prepare something fitting.</Text>
        <View style={styles.chipWrap}>
          {[...PURPOSES, "Other"].map((p) => (
            <Chip key={p} label={p} active={purpose === p} onPress={() => setPurpose(p)} />
          ))}
        </View>
        {purpose === "Other" && (
          <Input label="" placeholder="Tell the home the occasion" value={customPurpose} onChangeText={setCustomPurpose} />
        )}

        <Input
          label="Number of people"
          placeholder="e.g. 40"
          icon="users"
          keyboardType="number-pad"
          helper="Optional — helps them cook the right quantity"
          value={people}
          onChangeText={setPeople}
        />

        {error && (
          <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={theme.color.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <Text style={styles.footnote}>
          The home reviews every request. You'll be notified when it's accepted, and you pay them
          directly afterwards.
        </Text>
      </ScrollView>

      {/* Sticky summary + CTA — the total and the action stay visible while the donor scrolls
          through occasion and headcount, so the commitment is never out of sight. */}
      <View style={[styles.footer, theme.elevation.level3, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
        <View style={styles.summary}>
          <Text style={styles.summaryDate} numberOfLines={1}>
            {selectedDate.toDateString()}
          </Text>
          <Text style={styles.summaryMeal} numberOfLines={1}>
            {selected ? selected.label : "Choose a meal"}
          </Text>
        </View>

        <View style={styles.footerRight}>
          {selected && <Text style={styles.summaryCost}>₹{selected.cost!.toLocaleString("en-IN")}</Text>}
          <Button
            label={isSubmitting ? "Booking…" : "Book now"}
            onPress={handleBook}
            disabled={!canSubmit}
            loading={isSubmitting}
            compact
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm },

  hero: {
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
  },
  heroLabel: { ...theme.typography.caption, color: "rgba(255,255,255,0.7)" },
  heroName: { ...theme.typography.h2, color: "#FFFFFF", marginTop: 2 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  heroMetaText: { ...theme.typography.caption, color: "rgba(255,255,255,0.75)" },

  card: {
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.surface,
    padding: theme.spacing.lg,
    overflow: "hidden",
    ...theme.elevation.level1,
  },

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  monthNav: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.primarySoft,
  },
  monthNavDisabled: { backgroundColor: theme.color.surfaceMuted },
  monthLabel: { ...theme.typography.bodyMedium, fontWeight: "800", color: theme.color.textPrimary },

  weekHeader: { flexDirection: "row", marginBottom: 4 },
  weekday: {
    ...theme.typography.caption,
    color: theme.color.textTertiary,
    fontWeight: "800",
    width: `${100 / 7}%`,
    textAlign: "center",
  },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayActive: { backgroundColor: theme.color.primary, ...theme.glow.primary },
  dayDisabled: { opacity: 0.3 },
  dayNumber: { ...theme.typography.bodySmall, color: theme.color.textPrimary, fontWeight: "600" },
  dayNumberActive: { color: theme.color.onPrimary, fontWeight: "800" },
  dayNumberDisabled: { color: theme.color.textTertiary },
  dayNumberToday: { color: theme.color.primary, fontWeight: "800" },
  fullDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.color.warning, marginTop: 2 },

  legend: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.color.primary },
  legendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.warning },
  legendText: { ...theme.typography.caption, color: theme.color.textSecondary },

  sectionTitle: { ...theme.typography.h3, color: theme.color.textPrimary, marginTop: theme.spacing.xl },
  sectionHint: { ...theme.typography.caption, color: theme.color.textTertiary, marginBottom: theme.spacing.sm },

  mealList: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  mealRowActive: { borderColor: theme.color.primary, backgroundColor: theme.color.primarySoft },
  mealRowTaken: { backgroundColor: theme.color.surfaceMuted, borderColor: theme.color.borderSubtle },
  mealText: { flex: 1, gap: 1 },
  mealName: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, fontWeight: "700" },
  mealTime: { ...theme.typography.caption, color: theme.color.textSecondary },
  mealTextMuted: { color: theme.color.textTertiary },
  mealCost: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, fontWeight: "800" },
  mealCostActive: { color: theme.color.primary },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.dangerSoft,
    marginTop: theme.spacing.md,
  },
  errorText: { ...theme.typography.caption, color: theme.color.dangerDeep, flex: 1, fontWeight: "600" },

  footnote: {
    ...theme.typography.caption,
    color: theme.color.textTertiary,
    textAlign: "center",
    marginTop: theme.spacing.lg,
    lineHeight: 17,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  summary: { flex: 1 },
  summaryDate: { ...theme.typography.caption, color: theme.color.textSecondary },
  summaryMeal: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, fontWeight: "700" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  summaryCost: { ...theme.typography.h3, color: theme.color.primary },
});
