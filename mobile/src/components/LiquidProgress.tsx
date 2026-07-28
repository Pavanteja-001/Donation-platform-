import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";

/**
 * A glass tube with liquid in it, for BLOOD unit progress.
 *
 * Why a bespoke component rather than the shared `ProgressBar`: a flat filled rounded rect reads
 * as a chart element. Blood units are a physical quantity, and showing them as liquid in a tube
 * makes "1 of 2 units" legible before you read the label.
 *
 * The glass illusion is four layers, bottom to top:
 *   1. tube interior — dark and slightly transparent, so it reads as empty volume
 *   2. liquid — vertical ramp (lighter at the top, deeper at the bottom, like real depth)
 *   3. meniscus — a bright line at the liquid's leading edge; without it the fill looks painted on
 *   4. cylinder highlight — a specular streak along the upper third, which is what actually makes
 *      a rectangle read as a *round* tube
 *
 * A slow shimmer travels along the filled portion so it reads as liquid rather than a static
 * block. It only runs when there's something to show and the need isn't complete.
 */
export function LiquidProgress({
  filled,
  total,
  label,
  height = 18,
  tone = "blood",
}: {
  filled: number;
  total: number;
  label?: string;
  height?: number;
  tone?: "blood" | "primary" | "success";
}) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.max(0, Math.min(1, filled / safeTotal));
  const isComplete = ratio >= 1;

  const fill = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // Spring, not timing: the liquid should settle like it has mass.
    fill.value = withSpring(ratio, { damping: 18, stiffness: 90, mass: 0.9 });
  }, [ratio, fill]);

  useEffect(() => {
    if (ratio <= 0 || isComplete) {
      shimmer.value = 0;
      return;
    }
    shimmer.value = withRepeat(withTiming(1, { duration: 2200 }), -1, false);
  }, [ratio, isComplete, shimmer]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value < 0.5 ? shimmer.value * 0.5 : (1 - shimmer.value) * 0.5,
    transform: [{ translateX: (shimmer.value - 0.5) * 120 }],
  }));

  const ramp =
    tone === "blood"
      ? (["#E23B3B", "#B91C1C", "#7A1010"] as const)
      : tone === "success"
        ? (["#34D399", "#0E9F6E", "#07684A"] as const)
        : (["#D33B3B", "#B91C1C", "#8E1414"] as const);

  return (
    <View style={styles.wrap}>
      <View style={[styles.tube, { height, borderRadius: height / 2 }]}>
        {/* 1. Interior — a recess, so it's darker at the top where light doesn't reach. */}
        <LinearGradient
          colors={["rgba(60,20,22,0.16)", "rgba(60,20,22,0.06)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[styles.fill, fillStyle, { borderRadius: height / 2 }]}>
          {/* 2. Liquid */}
          <LinearGradient
            colors={ramp as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* 3. Travelling shimmer */}
          <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none">
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          {/* Meniscus at the leading edge */}
          <View style={styles.meniscus} pointerEvents="none" />
        </Animated.View>

        {/* 4. Cylinder highlight — the layer that sells "round tube" over "flat bar". */}
        <LinearGradient
          colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.05)", "rgba(0,0,0,0.10)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
          pointerEvents="none"
        />
        <View style={[styles.rim, { borderRadius: height / 2 }]} pointerEvents="none" />
      </View>

      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.percent, isComplete && styles.percentComplete]}>{Math.round(ratio * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  tube: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: theme.color.surfaceSunken,
  },
  fill: { height: "100%", overflow: "hidden" },
  shimmer: { position: "absolute", top: 0, bottom: 0, width: 60 },
  meniscus: { position: "absolute", top: 0, bottom: 0, right: 0, width: 2, backgroundColor: "rgba(255,255,255,0.65)" },
  rim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(124,45,45,0.18)",
  },
  // `space-between` rather than a fixed gap: the count sits left, the percentage right, so both
  // stay aligned to the tube's ends however long the text is.
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "600" },
  percent: { ...theme.typography.caption, color: theme.color.textTertiary, fontWeight: "800" },
  percentComplete: { color: theme.color.success },
});
