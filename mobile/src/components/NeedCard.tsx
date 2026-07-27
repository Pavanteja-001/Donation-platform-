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
import { ProgressBar, type ProgressTone } from "./ProgressBar";
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
}: {
  need: Need;
  userLat?: number | null;
  userLng?: number | null;
  onPress?: () => void;
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
        <Gradient colors={theme.gradient.brand} direction="horizontal" bands={20} style={styles.emergencyStrip}>
          <Feather name="alert-triangle" size={12} color={theme.color.onBlood} />
          <Text style={styles.emergencyStripText}>Emergency · needs donors now</Text>
        </Gradient>
      )}

      {cover && (
        <Image
          source={{ uri: cover }}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={220}
          // Without this, FlashList recycling shows the previous row's photo for a frame
          // before the new one decodes.
          recyclingKey={need.id}
        />
      )}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.typeGroup}>
            <View style={[styles.typeIcon, { backgroundColor: meta.tint }]}>
              <Feather name={meta.icon} size={13} color={meta.color} />
            </View>
            <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
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

        <Text style={styles.title} numberOfLines={2}>
          {need.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {need.description}
        </Text>

        {money && (
          <View style={styles.stats}>
            <View style={styles.amountRow}>
              <Text style={styles.amount}>{formatAmount(money.raised_amount)}</Text>
              <Text style={styles.amountTarget}>of {formatAmount(money.target_amount)}</Text>
            </View>
            <ProgressBar raised={money.raised_amount} target={money.target_amount} showLabel={false} />
          </View>
        )}

        {blood && (
          <View style={styles.stats}>
            <View style={styles.amountRow}>
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
            <ProgressBar
              raised={blood.units_fulfilled}
              target={blood.units_needed}
              tone={progressTone}
              showLabel={false}
            />
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
            {posted && <Text style={styles.footerText}>{posted}</Text>}
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
  body: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  typeGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  typeIcon: { width: 26, height: 26, borderRadius: theme.radii.xs, alignItems: "center", justifyContent: "center" },
  typeLabel: { ...theme.typography.overline, textTransform: "uppercase" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { ...theme.typography.h3, color: theme.color.textPrimary },
  description: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  stats: { marginTop: theme.spacing.xs, gap: theme.spacing.sm },
  amountRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: theme.spacing.sm },
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
