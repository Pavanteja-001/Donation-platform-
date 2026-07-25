import { StyleSheet, Text, View } from "react-native";
import type { Need, Urgency } from "../lib/api";
import { theme } from "../lib/theme";

// PRD Appendix A: red is reserved for danger/emergency/blood urgency only.
const URGENCY_STYLE: Record<Urgency, { label: string; background: string; color: string }> = {
  EMERGENCY: { label: "Emergency", background: theme.color.danger, color: theme.color.onPrimary },
  URGENT: { label: "Urgent", background: theme.color.accent, color: theme.color.textPrimary },
  NORMAL: { label: "Normal", background: theme.color.border, color: theme.color.textSecondary },
};

export function NeedCard({ need }: { need: Need }) {
  const urgency = URGENCY_STYLE[need.urgency];
  const location = [need.area, need.city].filter(Boolean).join(", ");

  return (
    <View style={styles.card}>
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
      {location ? <Text style={styles.meta}>{location}</Text> : null}
    </View>
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
  meta: { fontSize: 12, color: theme.color.textSecondary },
});
