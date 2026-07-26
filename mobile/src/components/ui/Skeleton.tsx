import { useEffect } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { theme } from "../../lib/theme";

// PRD Appendix A.5 — loading state. A single pulsing block; screens compose several of these
// into a skeleton shape. Overhauled with Reanimated to ensure 60/120fps UI thread execution.
export function Skeleton({
  width = "100%",
  height = 16,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: theme.motion.normal * 2 }),
        withTiming(0.4, { duration: theme.motion.normal * 2 })
      ),
      -1, // Infinite loop
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return <Animated.View style={[styles.block, { width, height }, animatedStyle, style]} />;
}

const styles = StyleSheet.create({
  block: { backgroundColor: theme.color.border, borderRadius: theme.radius / 2 }, // smaller radius for precise skeleton look
});
