import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Need } from "../lib/api";
import { emergencyCountMemo, rememberEmergencyCount } from "../lib/listCache";
import { theme } from "../lib/theme";
import {
  TYPE_META,
  formatAmount,
  formatBloodGroup,
  isBloodPayload,
  isMoneyPayload,
  num,
} from "../lib/needMeta";
import { Gradient } from "./Gradient";
import { VitalsTrace } from "./VitalsTrace";
import { EmergencyPulse } from "./EmergencyPulse";
import { ProgressBar } from "./ProgressBar";
import { PressableScale, Skeleton } from "./ui";

/**
 * The pinned Emergency rail at the top of the feed.
 *
 * D-012 says emergency needs are pinned until fulfilled — but sorting them first only meant they
 * appeared first while looking identical to everything else. A dark full-bleed rail is what makes
 * "pinned" legible: it reads as a different class of content before you read a single word.
 *
 * Renders nothing when there are no emergencies, so the feed doesn't carry a permanent empty rail
 * — and so the treatment stays rare enough to keep its meaning.
 */
export function EmergencySpotlight({
  needs,
  onSelectNeed,
  isLoading = false,
}: {
  needs: Need[];
  onSelectNeed: (need: Need) => void;
  /** Feed is fetching. Shimmers the rail instead of leaving a gap where it will appear. */
  isLoading?: boolean;
}) {
  const { width } = useWindowDimensions();
  const emergencies = needs.filter((n) => n.urgency === "EMERGENCY");

  // Remembered for the next launch, so a cold start shimmers the right number of tiles instead of
  // leaving a gap where the rail is about to appear. In an effect, not in render — it writes to
  // storage, and render must stay free of side effects.
  useEffect(() => {
    if (!isLoading) rememberEmergencyCount(emergencies.length);
  }, [isLoading, emergencies.length]);

  const placeholders = isLoading ? Math.min(emergencyCountMemo.count, 3) : 0;
  if (emergencies.length === 0 && placeholders === 0) return null;

  // Portrait tiles, story-rail proportions. A 320dp-wide card showed one emergency at a time and
  // ate half the feed to do it; at this size three fit across with the fourth peeking, so the rail
  // reads as "several cases" at a glance — which is the actual message when more than one is open.
  const cardWidth = Math.min(Math.max((width - theme.spacing.lg * 2 - theme.spacing.sm * 2) / 2.6, 132), 158);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <EmergencyPulse radius={theme.radii.pill}>
          <View style={styles.liveDot} />
        </EmergencyPulse>
        <Text style={styles.headerText}>Emergency now</Text>
        {placeholders > 0 ? (
          <Skeleton width={48} height={12} />
        ) : (
          <Text style={styles.headerCount}>
            {emergencies.length} {emergencies.length === 1 ? "case" : "cases"}
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        decelerationRate="fast"
        snapToInterval={cardWidth + theme.spacing.sm}
        snapToAlignment="start"
      >
        {placeholders > 0
          ? Array.from({ length: placeholders }, (_, i) => (
              <Skeleton key={i} width={cardWidth} height={cardWidth / 0.86} radius={theme.radii.xl} />
            ))
          : emergencies.map((need) => (
              <SpotlightCard key={need.id} need={need} width={cardWidth} onPress={() => onSelectNeed(need)} />
            ))}
      </ScrollView>
    </View>
  );
}

function SpotlightCard({ need, width, onPress }: { need: Need; width: number; onPress: () => void }) {
  const meta = TYPE_META[need.type];
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const location = [need.area, need.city].filter(Boolean).join(", ");


  // The tile itself is the button — tapping anywhere opens the need, where the actual
  // respond/donate step sits behind its own confirmation. It must never be one tap from a feed.
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={`Emergency: ${need.title}. ${need.type === "BLOOD" ? "Tap to donate" : "Tap to help"}`}
    >
      <Gradient colors={theme.gradient.brandDeep} style={[styles.card, { width }, theme.elevation.level3]}>
        {/* Behind the content, inside the card. A hairline rather than a fill, so nothing it does
            can come between a reader and "O- needed at KGH". */}
        <VitalsTrace />

        <View>
          <View style={styles.cardTop}>
          <View style={styles.typeTag}>
            <Feather name={meta.icon} size={11} color="#FFFFFF" />
            <Text style={styles.typeTagText}>{meta.label}</Text>
          </View>

          {blood && (
            <EmergencyPulse color="#FFFFFF">
              <View style={styles.bloodPill}>
                <Text style={styles.bloodPillText}>{formatBloodGroup(blood.blood_group)}</Text>
              </View>
            </EmergencyPulse>
          )}
        </View>

          <Text style={styles.title} numberOfLines={3}>
            {need.title}
          </Text>

          {location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color="rgba(255,255,255,0.7)" />
              <Text style={styles.locationText} numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <View style={styles.progressBlock}>
            {blood && (
              <>
                <Text style={styles.progressLabel}>
                  {num(blood.units_fulfilled)} of {num(blood.units_needed)} units matched
                </Text>
              <ProgressBar
                raised={blood.units_fulfilled}
                target={blood.units_needed}
                showLabel={false}
                height={5}
                onDark
              />
            </>
          )}
          {money && (
            <>
              <Text style={styles.progressLabel}>
                {formatAmount(money.raised_amount)} of {formatAmount(money.target_amount)}
              </Text>
              <ProgressBar
                raised={money.raised_amount}
                target={money.target_amount}
                showLabel={false}
                height={5}
                onDark
              />
            </>
          )}
        </View>

        </View>
      </Gradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: theme.spacing.lg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.emergency },
  headerText: {
    ...theme.typography.overline,
    color: theme.color.textPrimary,
    textTransform: "uppercase",
    flex: 1,
    marginLeft: theme.spacing.xs,
  },
  headerCount: { ...theme.typography.caption, color: theme.color.textTertiary, fontWeight: "700" },

  railContent: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  card: {
    // Taller than wide, like a story tile. The fixed ratio is what keeps the rail even when one
    // case has a short title and another wraps to three lines.
    aspectRatio: 0.86,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  typeTagText: { ...theme.typography.overline, color: "#FFFFFF", textTransform: "uppercase", fontSize: 9 },
  bloodPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  bloodPillText: { fontSize: 12, fontWeight: "800", color: theme.color.primaryDeep, letterSpacing: -0.2 },

  title: { fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: -0.2, color: "#FFFFFF", marginTop: theme.spacing.sm },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { ...theme.typography.caption, color: "rgba(255,255,255,0.7)", fontSize: 10, flexShrink: 1 },

  progressBlock: { gap: 5 },
  progressLabel: { ...theme.typography.caption, color: "rgba(255,255,255,0.82)", fontWeight: "700", fontSize: 10 },

});
