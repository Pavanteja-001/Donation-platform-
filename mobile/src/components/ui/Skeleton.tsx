import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "../../lib/theme";

// PRD Appendix A.5 — loading state. A single pulsing block; screens compose several of these
// into a skeleton shape (e.g. NeedCard's photo/title/progress-bar outline) rather than a bare
// spinner, so a loading list doesn't jump/reflow once real content arrives.
export function Skeleton({ width = "100%", height = 16, style }: { width?: number | `${number}%`; height?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: theme.motion.normal * 2, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: theme.motion.normal * 2, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, opacity }, style]} />;
}

const styles = StyleSheet.create({
  block: { backgroundColor: theme.color.border, borderRadius: theme.radius },
});
