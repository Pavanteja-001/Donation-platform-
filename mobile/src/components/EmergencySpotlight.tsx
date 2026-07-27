import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Need } from "../lib/api";
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
import { EmergencyPulse } from "./EmergencyPulse";
import { ProgressBar } from "./ProgressBar";
import { PressableScale } from "./ui";

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
}: {
  needs: Need[];
  onSelectNeed: (need: Need) => void;
}) {
  const { width } = useWindowDimensions();
  const emergencies = needs.filter((n) => n.urgency === "EMERGENCY");

  if (emergencies.length === 0) return null;

  // Cards stop short of full width so the next one peeks in — the clearest possible signal that
  // the rail scrolls, without adding a hint or an arrow.
  const cardWidth = Math.min(width * 0.78, 320);

  return (
    <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={styles.wrap}>
      <View style={styles.headerRow}>
        <EmergencyPulse radius={theme.radii.pill}>
          <View style={styles.liveDot} />
        </EmergencyPulse>
        <Text style={styles.headerText}>Emergency now</Text>
        <Text style={styles.headerCount}>
          {emergencies.length} {emergencies.length === 1 ? "case" : "cases"}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        decelerationRate="fast"
        snapToInterval={cardWidth + theme.spacing.md}
        snapToAlignment="start"
      >
        {emergencies.map((need) => (
          <SpotlightCard key={need.id} need={need} width={cardWidth} onPress={() => onSelectNeed(need)} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function SpotlightCard({ need, width, onPress }: { need: Need; width: number; onPress: () => void }) {
  const meta = TYPE_META[need.type];
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const location = [need.area, need.city].filter(Boolean).join(", ");

  return (
    <PressableScale onPress={onPress} scaleTo={0.97} accessibilityLabel={`Emergency: ${need.title}`}>
      <Gradient colors={theme.gradient.brandDeep} style={[styles.card, { width }, theme.elevation.level3]}>
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

        <Text style={styles.title} numberOfLines={2}>
          {need.title}
        </Text>

        {location ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={11} color="rgba(255,255,255,0.7)" />
            <Text style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

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
                height={6}
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
                height={6}
                onDark
              />
            </>
          )}
        </View>

        {/* Styled as a call to action but it opens the need — the actual respond/donate step lives
            on the detail screen behind its own confirmation, and must not be one tap from a feed. */}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{need.type === "BLOOD" ? "I can donate" : "Help now"}</Text>
          <Feather name="arrow-right" size={15} color={theme.color.primaryDeep} />
        </View>
      </Gradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: theme.spacing.xl },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
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

  railContent: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  card: {
    borderRadius: theme.radii.xxl,
    padding: theme.spacing.lg,
    overflow: "hidden",
    gap: theme.spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
  },
  typeTagText: { ...theme.typography.overline, color: "#FFFFFF", textTransform: "uppercase" },
  bloodPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
  },
  bloodPillText: { fontSize: 14, fontWeight: "800", color: theme.color.primaryDeep, letterSpacing: -0.2 },

  title: { ...theme.typography.h3, color: "#FFFFFF" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -theme.spacing.xs },
  locationText: { ...theme.typography.caption, color: "rgba(255,255,255,0.7)", flexShrink: 1 },

  progressBlock: { gap: theme.spacing.sm },
  progressLabel: { ...theme.typography.caption, color: "rgba(255,255,255,0.82)", fontWeight: "700" },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  ctaText: { fontSize: 14, fontWeight: "800", color: theme.color.primaryDeep },
});
