import { useEffect, useRef } from "react";
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
 * Hand-rolled as a worklet because this runs on the UI thread on every animation frame.
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

/** Compact Indian formatting (Crore/Lakh/K) for currency and stats. */
function formatCompactWorklet(value: number): string {
  "worklet";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) {
    const val = abs / 1e7;
    const rounded = Math.round(val * 10) / 10;
    const str = String(rounded);
    const formatted = str.endsWith(".0") ? str.slice(0, -2) : str;
    return `${sign}${formatted}Cr`;
  }
  if (abs >= 1e5) {
    const val = abs / 1e5;
    const rounded = Math.round(val * 10) / 10;
    const str = String(rounded);
    const formatted = str.endsWith(".0") ? str.slice(0, -2) : str;
    return `${sign}${formatted}L`;
  }
  if (abs >= 1e3) {
    const val = abs / 1e3;
    const rounded = Math.round(val * 10) / 10;
    const str = String(rounded);
    const formatted = str.endsWith(".0") ? str.slice(0, -2) : str;
    return `${sign}${formatted}K`;
  }
  return groupIndian(value);
}

export function AnimatedCounter({
  value,
  fromValue,
  prefix = "",
  suffix = "",
  duration = 600,
  compact = false,
  style,
  animateOnMount = false,
}: {
  value: number;
  fromValue?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  compact?: boolean;
  style?: StyleProp<TextStyle>;
  animateOnMount?: boolean;
}) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const initialValue = typeof fromValue === "number" && Number.isFinite(fromValue) 
    ? fromValue 
    : (animateOnMount ? 0 : safeValue);

  const progress = useSharedValue(initialValue);
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      // On initial mount, if we didn't animateOnMount and no explicit fromValue, stay at initialValue
      if (!animateOnMount && fromValue === undefined) {
        progress.value = safeValue;
        return;
      }
    }
    progress.value = withTiming(safeValue, { duration, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [safeValue, duration, animateOnMount, fromValue, progress]);

  const animatedProps = useAnimatedProps(() => {
    const formatted = compact ? formatCompactWorklet(progress.value) : groupIndian(progress.value);
    const displayText = `${prefix}${formatted}${suffix}`;
    return {
      text: displayText,
      defaultValue: displayText,
    } as never;
  });

  const initialFormatted = compact ? formatCompactWorklet(initialValue) : groupIndian(initialValue);

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={[styles.text, style]}
      animatedProps={animatedProps}
      defaultValue={`${prefix}${initialFormatted}${suffix}`}
      accessibilityLabel={`${prefix}${safeValue}${suffix}`}
      pointerEvents="none"
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    color: theme.color.textPrimary,
    includeFontPadding: false,
  },
});
