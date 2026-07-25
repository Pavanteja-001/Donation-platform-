import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MoneyPayload, Need, Urgency } from "../lib/api";
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

export function NeedCard({ need, onPress }: { need: Need; onPress?: () => void }) {
  const urgency = URGENCY_STYLE[need.urgency];
  const location = [need.area, need.city].filter(Boolean).join(", ");
  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
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
  meta: { fontSize: 12, color: theme.color.textSecondary },
});
