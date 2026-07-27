import { useEffect } from "react";
import { StyleSheet, TextInput, type TextStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { theme } from "../lib/theme";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Indian digit grouping (last 3, then pairs): 4500000 → "45,00,000".
 *
 * Hand-rolled as a worklet because this runs on the UI thread on every animation frame, and
 * Hermes' `toLocaleString("en-IN")` isn't dependable inside a worklet.
 */
function groupIndian(value: number): string {
  "worklet";
  const negative = value < 0;
  const digits = String(Math.abs(Math.round(value)));

  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    let rest = digits.slice(0, -3);
    const parts: string[] = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length > 0) parts.unshift(rest);
    grouped = `${parts.join(",")},${last3}`;
  }

  return negative ? `-${grouped}` : grouped;
}

/**
 * A number that counts up to its value instead of snapping to it.
 *
 * Uses `useAnimatedProps` to drive the text on the UI thread — re-rendering React ~60 times a
 * second to animate a label would be far more expensive than the effect is worth.
 *
 * Deliberately NOT used in the feed: FlashList recycles rows, so a counter would replay its
 * count-up every time a card scrolled back into view.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 900,
  style,
  /** Skip the animation and render the final value (e.g. when a screen re-renders on refresh). */
  animate = true,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
}) {
  const progress = useSharedValue(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      progress.value = value;
      return;
    }
    progress.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [value, duration, animate, progress]);

  const animatedProps = useAnimatedProps(() => {
    return {
      text: `${prefix}${groupIndian(progress.value)}${suffix}`,
      // `value` is required alongside `text` for the native side to accept the update.
      defaultValue: `${prefix}${groupIndian(progress.value)}${suffix}`,
    } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      // A TextInput is the only RN primitive whose content can be set from a worklet, so this is
      // styled to be indistinguishable from a Text node.
      underlineColorAndroid="transparent"
      style={[styles.text, style]}
      animatedProps={animatedProps}
      defaultValue={`${prefix}${groupIndian(animate ? 0 : value)}${suffix}`}
      accessibilityLabel={`${prefix}${value}${suffix}`}
      pointerEvents="none"
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    // Strip every default TextInput affordance so it reads as plain text.
    padding: 0,
    margin: 0,
    borderWidth: 0,
    color: theme.color.textPrimary,
    includeFontPadding: false,
  },
});
