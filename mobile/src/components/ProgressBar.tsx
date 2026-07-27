import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from "react-native-reanimated";
import { theme } from "../lib/theme";

export type ProgressTone = "primary" | "blood" | "accent" | "success";

const TONE_COLOR: Record<ProgressTone, string> = {
  primary: theme.color.primary,
  blood: theme.color.blood,
  accent: theme.color.accent,
  success: theme.color.success,
};

/**
 * PRD §7.4/§9.4 — the public progress bar shown on every money need.
 *
 * `tone` exists so a BLOOD need's units bar fills crimson while a money need fills teal, without
 * the call site reaching past this component for a colour.
 */
export function ProgressBar({
  raised = 0,
  target = 0,
  label,
  tone = "primary",
  /** Hide the caption when the parent already states the numbers. */
  showLabel = true,
  height = 8,
}: {
  raised?: number;
  target?: number;
  label?: string;
  tone?: ProgressTone;
  showLabel?: boolean;
  height?: number;
}) {
  const safeRaised = raised ?? 0;
  const safeTarget = target ?? 0;
  const pct = safeTarget > 0 ? Math.min(safeRaised / safeTarget, 1) : 0;
  const isComplete = pct >= 1;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [pct, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // A fully funded need reads as success regardless of its type — reaching the goal is the
  // message at that point, not which category it belongs to.
  const fillColor = isComplete ? theme.color.success : TONE_COLOR[tone];

  return (
    <View>
      <View style={[styles.track, { height, borderRadius: height }]}>
        <Animated.View style={[styles.fill, { backgroundColor: fillColor, borderRadius: height }, animatedStyle]} />
      </View>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {label ?? `₹${safeRaised.toLocaleString("en-IN")} raised of ₹${safeTarget.toLocaleString("en-IN")}`}
          </Text>
          <Text style={[styles.pct, isComplete && { color: theme.color.success }]}>{Math.round(pct * 100)}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: theme.color.surfaceSunken,
    overflow: "hidden",
    width: "100%",
  },
  fill: { height: "100%" },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  label: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  pct: { ...theme.typography.caption, fontWeight: "800", color: theme.color.textPrimary },
});
