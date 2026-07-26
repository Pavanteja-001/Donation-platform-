import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { theme } from "../lib/theme";

// PRD §7.4/§9.4 — public progress bar. Overhauled with Reanimated to animate the width fill.
export function ProgressBar({ raised = 0, target = 0, label }: { raised?: number; target?: number; label?: string }) {
  const safeRaised = raised ?? 0;
  const safeTarget = target ?? 0;
  const pct = safeTarget > 0 ? Math.min(safeRaised / safeTarget, 1) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 800 });
  }, [pct]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  return (
    <View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
      <Text style={styles.label}>
        {label ?? `₹${safeRaised.toLocaleString("en-IN")} raised of ₹${safeTarget.toLocaleString("en-IN")}`}
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
    fontWeight: "500", // slightly bolder label
  },
});
