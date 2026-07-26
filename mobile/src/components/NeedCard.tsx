import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Image } from "expo-image";
import type { BloodPayload, GoodsPayload, KitPayload, MealSlotPayload, MoneyPayload, Need, Urgency } from "../lib/api";
import { theme } from "../lib/theme";
import { ProgressBar } from "./ProgressBar";

// PRD Appendix A: red is reserved for danger/emergency/blood urgency only.
const URGENCY_STYLE: Record<Urgency, { label: string; background: string; color: string }> = {
  EMERGENCY: { label: "Emergency", background: theme.color.danger, color: theme.color.onPrimary },
  URGENT: { label: "Urgent", background: theme.color.accent, color: theme.color.textPrimary },
  NORMAL: { label: "Normal", background: theme.color.border, color: theme.color.textSecondary },
};

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

function isKitPayload(payload: Need["payload"]): payload is KitPayload {
  return !!payload && typeof (payload as KitPayload).kits_needed === "number";
}

function isBloodPayload(payload: Need["payload"]): payload is BloodPayload {
  return !!payload && typeof (payload as BloodPayload).units_needed === "number";
}

function isMealSlotPayload(payload: Need["payload"]): payload is MealSlotPayload {
  return !!payload && typeof (payload as MealSlotPayload).slots_total === "number";
}

function isGoodsPayload(payload: Need["payload"]): payload is GoodsPayload {
  return !!payload && typeof (payload as GoodsPayload).item === "string";
}

function formatBloodGroup(g: string) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NeedCard({ need, onPress }: { need: Need; onPress?: () => void }) {
  const urgency = URGENCY_STYLE[need.urgency];
  const location = [need.area, need.city].filter(Boolean).join(", ");
  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const mealSlot = need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload) ? need.payload : null;
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 350 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 350 });
    }
  };

  return (
    <AnimatedPressable
      style={[styles.card, theme.elevation.level1, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
    >
      {need.photos.length > 0 && (
        <Image
          source={{ uri: need.photos[0] }}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      )}
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: urgency.background }]}>
          <Text style={[styles.badgeText, { color: urgency.color }]}>{urgency.label}</Text>
        </View>
        <Text style={styles.type}>{need.type.replace("_", " ")}</Text>
      </View>
      <Text style={styles.title}>{need.title}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {need.description}
      </Text>
      {money && (
        <View style={styles.progress}>
          <ProgressBar raised={money.raised_amount} target={money.target_amount} />
        </View>
      )}
      {kit && (
        <View style={styles.progress}>
          <ProgressBar
            raised={kit.kits_funded}
            target={kit.kits_needed}
            label={`${kit.kits_funded} of ${kit.kits_needed} kits funded`}
          />
        </View>
      )}
      {blood && (
        <View style={styles.progress}>
          <Text style={styles.bloodGroup}>{formatBloodGroup(blood.blood_group)}</Text>
          <ProgressBar
            raised={blood.units_fulfilled}
            target={blood.units_needed}
            label={`${blood.units_fulfilled} of ${blood.units_needed} units`}
          />
        </View>
      )}
      {mealSlot && (
        <View style={styles.progress}>
          <Text style={styles.mealType}>{mealSlot.meal_type}</Text>
          <ProgressBar
            raised={mealSlot.slots_confirmed}
            target={mealSlot.slots_total}
            label={`${mealSlot.slots_confirmed} of ${mealSlot.slots_total} slots confirmed`}
          />
        </View>
      )}
      {goods && (
        <View style={styles.progress}>
          <Text style={styles.mealType}>{goods.item}</Text>
          <Text style={styles.meta}>Condition: {goods.condition}</Text>
        </View>
      )}
      {location ? <Text style={styles.meta}>{location}</Text> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius * 1.2,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
  },
  cover: {
    height: 150,
    marginHorizontal: -theme.spacing.lg,
    marginTop: -theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.color.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 6, // slightly squared badge corners for premium dashboard look
  },
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  type: { fontSize: 11, color: theme.color.textSecondary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 17, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 4 },
  description: { fontSize: 13, color: theme.color.textSecondary, marginBottom: theme.spacing.sm, lineHeight: 18 },
  progress: { marginBottom: theme.spacing.sm },
  bloodGroup: { fontSize: 13, fontWeight: "700", color: theme.color.danger, marginBottom: 4 },
  mealType: { fontSize: 13, fontWeight: "700", color: theme.color.primary, marginBottom: 4, textTransform: "capitalize" },
  meta: { fontSize: 12, color: theme.color.textSecondary, fontWeight: "500" },
});
