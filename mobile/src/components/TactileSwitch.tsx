import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";

const TRACK_W = 56;
const TRACK_H = 32;
const KNOB = 26;
const TRAVEL = TRACK_W - KNOB - 6;

/**
 * A switch that reads as a physical control.
 *
 * The platform `Switch` is deliberately flat, can't be styled beyond two tint colours, and looks
 * visibly different on iOS vs Android — on a screen where everything else has depth, it was the
 * one element that still looked like a form widget.
 *
 * Four things do the work here:
 *  - the track is *recessed*: dark at the top, light at the bottom, i.e. the inverse of every
 *    raised surface in the app, which is how a groove reads under a top-left light,
 *  - the knob is raised: light top-left, shaded bottom-right, with its own drop shadow,
 *  - the knob overshoots slightly on release (spring, not timing) so it feels sprung rather than
 *    animated,
 *  - the track colour crossfades rather than snapping.
 *
 * RN cannot do true inset shadows (Android has none at all), so the recess is a gradient — the
 * one place this is an approximation rather than the real thing.
 */
export function TactileSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const progress = useDerivedValue(
    () => withSpring(value ? 1 : 0, { damping: 15, stiffness: 190, mass: 0.6 }),
    [value]
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["#E2D4D5", theme.color.success]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [3, 3 + TRAVEL]) },
      // A touch of squash at the midpoint — the knob reads as a physical object being pushed,
      // not a circle being teleported.
      { scaleX: interpolate(progress.value, [0, 0.5, 1], [1, 1.08, 1]) },
    ],
  }));

  useEffect(() => {
    // Keeps the spring in sync if the value is changed externally (e.g. a failed save reverts it).
  }, [value]);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        {/* Recess: dark at the top edge fading out — the inverse of a raised surface. */}
        <LinearGradient
          colors={["rgba(0,0,0,0.22)", "rgba(0,0,0,0)", "rgba(255,255,255,0.28)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Animated.View style={[styles.knob, knobStyle]}>
          <LinearGradient
            colors={["#FFFFFF", "#F1E7E7", "#D9C9CA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Gloss on the lit half only */}
          <LinearGradient
            colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,0)"]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.6, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.knobRim} pointerEvents="none" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,45,45,0.12)",
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    overflow: "hidden",
    shadowColor: "#3B0A0A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 4,
  },
  knobRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: KNOB / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.7)",
  },
  disabled: { opacity: 0.5 },
});
