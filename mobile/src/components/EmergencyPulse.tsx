import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
} from "react-native-reanimated";
import { theme } from "../lib/theme";

/**
 * A slow radiating ring, used only on EMERGENCY needs and the blood-group pill.
 *
 * Deliberately slow (1.8s) and low-opacity: this marks the small number of genuinely
 * time-critical cases (D-012), and a fast or bright pulse would read as a decorative loading
 * state rather than urgency. If everything pulses, nothing is urgent.
 */
export function EmergencyPulse({
  children,
  // Hotter than the crimson brand on purpose — now that red carries every primary action, the
  // pulse has to out-read the brand colour to still mean "urgent" (D-025).
  color = theme.color.emergency,
  /** Ring corner radius — match the wrapped element so the ring traces its shape. */
  radius = theme.radii.pill,
  active = true,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  radius?: number;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      {active && (
        <>
          <Ring color={color} radius={radius} delay={0} />
          <Ring color={color} radius={radius} delay={900} />
        </>
      )}
      {children}
    </View>
  );
}

function Ring({ color, radius, delay }: { color: string; radius: number; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false)
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    // Expands outward while fading — the ring never overlaps its own next cycle.
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.45]) }],
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.4, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { borderColor: color, borderRadius: radius }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", alignSelf: "flex-start" },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
});
