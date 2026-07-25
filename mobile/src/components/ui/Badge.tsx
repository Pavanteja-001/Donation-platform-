import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

// PRD Appendix A.4 — "badges (verified, trust tier)" + need-status badges. `tone` is the visual
// language; callers map their own domain value (NeedStatus/Role/TrustTier/...) to a tone rather
// than this component knowing about any of them — keeps it reusable across every badge use case
// already in the app (status, role, trust tier, verified) without a domain-specific prop per use.
export type BadgeTone = "primary" | "accent" | "danger" | "neutral";

const TONE_STYLE: Record<BadgeTone, { background: string; color: string }> = {
  primary: { background: theme.color.primary, color: theme.color.onPrimary },
  accent: { background: theme.color.accent, color: theme.color.textPrimary },
  danger: { background: theme.color.danger, color: theme.color.onPrimary },
  neutral: { background: theme.color.border, color: theme.color.textSecondary },
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const { background, color } = TONE_STYLE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  text: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
});
