import { StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";

// PRD §7.4/§9.4 — every MONEY/KIT need shows a public progress bar (raised/funded ÷ target).
// `label` overrides the default ₹-formatted one — used for kit needs ("X of Y kits").
export function ProgressBar({ raised, target, label }: { raised: number; target: number; label?: string }) {
  const pct = target > 0 ? Math.min(raised / target, 1) : 0;
  return (
    <View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.label}>
        {label ?? `₹${raised.toLocaleString("en-IN")} raised of ₹${target.toLocaleString("en-IN")}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.color.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.color.primary,
    borderRadius: 999,
  },
  label: {
    marginTop: theme.spacing.xs,
    fontSize: 12,
    color: theme.color.textSecondary,
  },
});
