import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { calculateDistanceKm } from "../lib/locationUtils";
import type { Need, Urgency } from "../lib/api";
import { theme } from "../lib/theme";
import {
  TYPE_META,
  isBloodPayload,
  isGoodsPayload,
  isKitPayload,
  isMealSlotPayload,
  isMoneyPayload,
  formatAmount,
  formatBloodGroup,
  timeAgo,
  type IconName,
} from "../lib/needMeta";
import { IconPlate, litRamp } from "./Depth";
import { BloodBagIllustration, KitBoxIllustration, RupeeStackIllustration } from "./illustrations";
import { ProgressBar, type ProgressTone } from "./ProgressBar";
import { LiquidProgress } from "./LiquidProgress";
import { EmergencyPulse } from "./EmergencyPulse";
import { Gradient } from "./Gradient";
import { Badge, PressableScale } from "./ui";

// D-025: crimson is the brand now, so urgency can't be signalled by hue alone — EMERGENCY is
// marked by a solid fill, the gradient strip and the pulse instead.
const URGENCY: Record<Urgency, { label: string; icon: IconName } | null> = {
  EMERGENCY: { label: "Emergency", icon: "alert-triangle" },
  URGENT: { label: "Urgent", icon: "clock" },
  // NORMAL is the default state — badging it adds noise to every card to say nothing.
  NORMAL: null,
};

function NeedCardComponent({
  need,
  userLat,
  userLng,
  onPress,
  compact = false,
}: {
  need: Need;
  userLat?: number | null;
  userLng?: number | null;
  onPress?: () => void;
  /**
   * Half-width rendering for the two-column grid.
   *
   * Not just a smaller card — at ~170dp several things stop fitting at all: the "₹25,000 / of
   * ₹85,000" row can't sit side by side, the type illustration plus its label plus an urgency
   * badge overflow one line, and a two-line description leaves no room for the progress bar that
   * actually drives donations. Each change below drops the least load-bearing element rather
   * than scaling everything down uniformly, which would just make it all illegible.
   */
  compact?: boolean;
}) {
  const urgency = URGENCY[need.urgency];
  const isEmergency = need.urgency === "EMERGENCY";
  const meta = TYPE_META[need.type];

  let distanceStr: string | null = null;
  if (userLat && userLng && need.latitude && need.longitude) {
    const km = calculateDistanceKm(userLat, userLng, need.latitude, need.longitude);
    distanceStr = `${km} km away`;
  }

  const rawLocation = [need.area, need.city].filter(Boolean).join(", ");
  const location = distanceStr ? `${rawLocation ? rawLocation + " · " : ""}${distanceStr}` : rawLocation;
  const posted = timeAgo(need.createdAt);
  const cover = need.photos.length > 0 ? need.photos[0] : null;

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const mealSlot = need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload) ? need.payload : null;
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;

  // Blood needs fill a deeper crimson; everything else uses the brand crimson.
  const progressTone: ProgressTone = need.type === "BLOOD" ? "blood" : "primary";

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${meta.label} need: ${need.title}`}
      style={[styles.card, theme.elevation.level2, isEmergency && styles.cardEmergency]}
    >
      {/* Emergency gets a full-bleed crimson strip rather than just another badge — at a glance
          down a scrolling feed, a coloured band is findable in a way a small pill is not. */}
      {isEmergency && (
        <Gradient colors={["#EF4444", "#B91C1C", "#7A1010"]} direction="horizontal" style={styles.emergencyStrip}>
          <Feather name="alert-triangle" size={12} color={theme.color.onBlood} />
          <Text style={styles.emergencyStripText} numberOfLines={1}>
            {compact ? "Emergency" : "Emergency · needs donors now"}
          </Text>
        </Gradient>
      )}

      {cover && (
        <Image
          source={{ uri: cover }}
          style={[styles.cover, compact && styles.coverCompact]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={220}
          // Without this, FlashList recycling shows the previous row's photo for a frame
          // before the new one decodes.
          recyclingKey={need.id}
        />
      )}

      {/* Lit from the top-left, like every raised surface in the app (see Depth.tsx). At 3%
          it isn't perceived as an effect — it just stops the card reading as flat paper. */}
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={styles.headerRow}>
          <View style={styles.typeGroup}>
            {/* The three types a donor scans for get a full illustration; everything else keeps
                the icon plate. Reserving the artwork for BLOOD/KIT/GOODS/MONEY is what stops the
                feed turning into a wall of competing pictures — the illustration IS the signal
                that this row is one of the flagship need types.

                The blood bag's fill level mirrors real fulfilment, so the artwork carries data
                rather than being decoration. */}
            {blood ? (
              <BloodBagIllustration
                size={compact ? 30 : 38}
                fillLevel={blood.units_needed > 0 ? blood.units_fulfilled / blood.units_needed : 0}
              />
            ) : need.type === "KIT" || need.type === "GOODS" ? (
              <KitBoxIllustration size={compact ? 30 : 38} />
            ) : need.type === "MONEY" ? (
              <RupeeStackIllustration size={compact ? 30 : 38} />
            ) : (
              <IconPlate icon={meta.icon} size="sm" tone="custom" colors={litRamp(meta.color)} />
            )}
            {/* The word "BLOOD" next to a blood bag is redundant at any width; at half width it's
                also what pushes the urgency badge off the row. The illustration carries the type. */}
            {!compact && <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>}
          </View>

          <View style={styles.headerRight}>
            {need.adminVerified && <Feather name="check-circle" size={14} color={theme.color.success} />}
            {urgency && (
              <Badge
                label={urgency.label}
                icon={urgency.icon}
                tone={isEmergency ? "blood" : "accent"}
                solid={isEmergency}
              />
            )}
          </View>
        </View>

        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
          {need.title}
        </Text>
        {/* Dropped in compact: the progress bar is what converts a browse into a donation, and
            with both present neither fits above the fold of a half-width card. */}
        {!compact && (
          <Text style={styles.description} numberOfLines={2}>
            {need.description}
          </Text>
        )}

        {money && (
          <View style={styles.stats}>
            <View style={[styles.amountRow, compact && styles.amountRowCompact]}>
              <Text style={styles.amount}>{formatAmount(money.raised_amount)}</Text>
              <Text style={styles.amountTarget}>of {formatAmount(money.target_amount)}</Text>
            </View>
            <ProgressBar raised={money.raised_amount} target={money.target_amount} showLabel={false} />
          </View>
        )}

        {blood && (
          <View style={styles.stats}>
            <View style={[styles.amountRow, compact && styles.amountRowCompact]}>
              {/* Pulses only on EMERGENCY (D-012), so the effect stays rare enough to mean
                  something in a scrolling feed. */}
              <EmergencyPulse active={isEmergency}>
                <View style={styles.bloodGroup}>
                  <Feather name="droplet" size={13} color={theme.color.onBlood} />
                  <Text style={styles.bloodGroupText}>{formatBloodGroup(blood.blood_group)}</Text>
                </View>
              </EmergencyPulse>
              <Text style={styles.unitsText}>
                {blood.units_fulfilled} of {blood.units_needed} units
              </Text>
            </View>
            {/* Same liquid tube as the detail screen — a donor shouldn't see blood progress
                rendered two different ways depending on which screen they're on. */}
            <LiquidProgress filled={blood.units_fulfilled} total={blood.units_needed} tone="blood" height={12} />
          </View>
        )}

        {kit && (
          <View style={styles.stats}>
            <ProgressBar
              raised={kit.kits_funded}
              target={kit.kits_needed}
              label={`${kit.kits_funded} of ${kit.kits_needed} kits funded`}
            />
          </View>
        )}

        {mealSlot && (
          <View style={styles.stats}>
            <ProgressBar
              raised={mealSlot.slots_confirmed}
              target={mealSlot.slots_total}
              tone="accent"
              label={`${mealSlot.slots_confirmed} of ${mealSlot.slots_total} ${mealSlot.meal_type} slots`}
            />
          </View>
        )}

        {/* GOODS has no partial state (§11.3) — a claimed/available badge pair, not a bar. */}
        {goods && (
          <View style={styles.goodsRow}>
            <Badge label={goods.item} tone="info" />
            <Badge label={goods.condition} tone="neutral" />
            {goods.claimed && <Badge label="Claimed" tone="success" icon="check" />}
          </View>
        )}

        {(location || posted) && (
          <View style={styles.footer}>
            {location ? (
              <View style={styles.footerItem}>
                <Feather name="map-pin" size={12} color={theme.color.textTertiary} />
                <Text style={styles.footerText} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            ) : (
              <View />
            )}
            {posted && !compact && <Text style={styles.footerText}>{posted}</Text>}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/**
 * Memoised because this renders inside a FlashList: without it every parent state change
 * (refresh flag, filter chip) re-renders every mounted row.
 */
export const NeedCard = memo(NeedCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xxl,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
  },
  cardEmergency: { borderColor: "rgba(153, 27, 27, 0.18)" },
  emergencyStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
  },
  emergencyStripText: {
    ...theme.typography.overline,
    color: theme.color.onBlood,
    textTransform: "uppercase",
  },
  cover: {
    height: 164,
    width: "100%",
    backgroundColor: theme.color.surfaceMuted,
  },
  // Roughly square at half width, rather than the wide banner a full-width card gets. Keeping 164
  // here would make the photo taller than it is wide and push everything else off screen.
  coverCompact: { height: 112 },
  body: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  bodyCompact: { padding: theme.spacing.md, gap: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  typeGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  typeIcon: { width: 26, height: 26, borderRadius: theme.radii.xs, alignItems: "center", justifyContent: "center" },
  typeLabel: { ...theme.typography.overline, textTransform: "uppercase" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { ...theme.typography.h3, color: theme.color.textPrimary },
  titleCompact: { fontSize: 15, lineHeight: 20 },
  description: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  stats: { marginTop: theme.spacing.xs, gap: theme.spacing.sm },
  amountRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: theme.spacing.sm },
  // Stacked, not side by side. "₹25,000" and "of ₹85,000" together need ~150dp; the card's inner
  // width at half screen is about 145dp, so on a narrow phone the target silently truncated.
  amountRowCompact: { flexDirection: "column", alignItems: "flex-start", gap: 0 },
  amount: { ...theme.typography.numeric, color: theme.color.textPrimary },
  amountTarget: { ...theme.typography.caption, color: theme.color.textSecondary },
  bloodGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.color.blood,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
  },
  bloodGroupText: { fontSize: 14, fontWeight: "800", color: theme.color.onBlood, letterSpacing: -0.2 },
  unitsText: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "700" },
  goodsRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap", marginTop: theme.spacing.xs },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  footerText: { ...theme.typography.caption, color: theme.color.textTertiary },
});
