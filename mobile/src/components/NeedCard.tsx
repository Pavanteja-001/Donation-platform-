import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import type { BloodPayload, KitPayload, MoneyPayload, Need, Urgency } from "../lib/api";
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

function formatBloodGroup(g: string) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

export function NeedCard({ need, onPress }: { need: Need; onPress?: () => void }) {
  const urgency = URGENCY_STYLE[need.urgency];
  const location = [need.area, need.city].filter(Boolean).join(", ");
  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      {need.photos.length > 0 && (
        <Image source={{ uri: need.photos[0] }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
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
      {location ? <Text style={styles.meta}>{location}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
  },
  cover: {
    height: 140,
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
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  type: { fontSize: 11, color: theme.color.textSecondary, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", color: theme.color.textPrimary, marginBottom: 4 },
  description: { fontSize: 13, color: theme.color.textSecondary, marginBottom: theme.spacing.xs },
  progress: { marginBottom: theme.spacing.xs },
  bloodGroup: { fontSize: 13, fontWeight: "700", color: theme.color.danger, marginBottom: 2 },
  meta: { fontSize: 12, color: theme.color.textSecondary },
});
