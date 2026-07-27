import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
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
  // Width of the filled portion, so the sheen can sweep across it in pixels.
  const [fillWidth, setFillWidth] = useState(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [pct, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  function handleFillLayout(e: LayoutChangeEvent) {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== fillWidth) setFillWidth(next);
  }

  // A sheen on a finished bar would suggest it's still working, so it stops at 100%.
  const showSheen = !isComplete && pct > 0 && fillWidth > 24;

  // A fully funded need reads as success regardless of its type — reaching the goal is the
  // message at that point, not which category it belongs to.
  const fillColor = isComplete ? theme.color.success : TONE_COLOR[tone];

  return (
    <View>
      <View style={[styles.track, { height, borderRadius: height }]}>
        <Animated.View
          onLayout={handleFillLayout}
          style={[styles.fill, { backgroundColor: fillColor, borderRadius: height }, animatedStyle]}
        >
          {showSheen && <Sheen width={fillWidth} />}
        </Animated.View>
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

/**
 * A slow highlight sweeping across the filled portion — signals "this is still being funded"
 * without adding another element to the layout. Same stacked-slice trick as `Skeleton`, so it
 * needs no gradient dependency.
 */
function Sheen({ width }: { width: number }) {
  const progress = useSharedValue(0);
  const bandWidth = Math.max(width * 0.35, 28);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, [width, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + progress.value * (width + bandWidth) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, { width: bandWidth }, animatedStyle]}>
      <View style={[styles.sheenSlice, styles.sheenEdge]} />
      <View style={[styles.sheenSlice, styles.sheenCore]} />
      <View style={[styles.sheenSlice, styles.sheenEdge]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: theme.color.surfaceSunken,
    overflow: "hidden",
    width: "100%",
  },
  fill: { height: "100%", overflow: "hidden" },
  sheen: { position: "absolute", top: 0, bottom: 0, left: 0, flexDirection: "row" },
  sheenSlice: { flex: 1, height: "100%" },
  sheenEdge: { backgroundColor: "rgba(255,255,255,0.10)" },
  sheenCore: { backgroundColor: "rgba(255,255,255,0.32)" },
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
