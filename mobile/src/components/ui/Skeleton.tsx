import { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { theme } from "../../lib/theme";

/**
 * PRD Appendix A.5 — loading state. A single shimmering block; screens compose several of these
 * into a skeleton that mirrors the real layout.
 *
 * The sweep is a translating highlight band rather than an opacity pulse. A pulse reads as
 * "something is broken and blinking"; a directional sweep reads as "content is arriving". Built
 * from stacked opacity bands instead of a gradient so this needs no extra native dependency.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = theme.radii.xs,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // The sweep is measured in pixels, so it can't start until the block has a real width.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (measuredWidth <= 0) return;

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: theme.motion.shimmer, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );

    // Without this the animation keeps running on the UI thread after the skeleton unmounts —
    // invisible, but it burns frames for the lifetime of the screen behind it.
    return () => cancelAnimation(progress);
  }, [measuredWidth, progress]);

  const bandWidth = Math.max(measuredWidth * 0.6, 64);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -bandWidth + progress.value * (measuredWidth + bandWidth) },
    ],
  }));

  function handleLayout(e: LayoutChangeEvent) {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== measuredWidth) setMeasuredWidth(next);
  }

  return (
    <View onLayout={handleLayout} style={[styles.block, { width, height, borderRadius: radius }, style]}>
      {measuredWidth > 0 && (
        <Animated.View style={[styles.band, { width: bandWidth }, animatedStyle]}>
          <View style={[styles.slice, styles.sliceEdge]} />
          <View style={[styles.slice, styles.sliceMid]} />
          <View style={[styles.slice, styles.sliceCore]} />
          <View style={[styles.slice, styles.sliceMid]} />
          <View style={[styles.slice, styles.sliceEdge]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: theme.color.surfaceSunken,
    overflow: "hidden",
  },
  // Anchored top/bottom/left only — `right` is deliberately omitted so the explicit band width
  // wins and the sweep can translate past the edges.
  band: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
  },
  // Five stacked slices approximate a soft gradient falloff well enough that the seams are
  // invisible in motion — and cost nothing but views.
  slice: { flex: 1, height: "100%" },
  sliceEdge: { backgroundColor: "rgba(255,255,255,0.08)" },
  sliceMid: { backgroundColor: "rgba(255,255,255,0.34)" },
  sliceCore: { backgroundColor: "rgba(255,255,255,0.62)" },
});
