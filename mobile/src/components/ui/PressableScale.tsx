import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle, type GestureResponderEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { theme } from "../../lib/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The single press-feedback primitive. Every tappable surface in the app composes this so the
 * whole UI shrinks by the same amount, on the same spring, driven on the UI thread.
 *
 * Defined once rather than per-component because press feel is the thing users notice most and
 * the easiest to let drift — three components hand-rolling `withSpring` is three different apps.
 */
export function PressableScale({
  children,
  style,
  onPress,
  onLongPress,
  disabled = false,
  scaleTo = theme.pressScale,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = "button",
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Override the shared press-scale. Larger surfaces want a subtler scale (e.g. 0.98). */
  scaleTo?: number;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link" | "tab" | "none";
  testID?: string;
}) {
  const scale = useSharedValue(1);
  // A press that can't fire anything shouldn't animate — silent feedback implies it worked.
  const isInteractive = !disabled && (!!onPress || !!onLongPress);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        if (isInteractive) scale.value = withSpring(scaleTo, theme.motion.spring.press);
      }}
      onPressOut={() => {
        if (isInteractive) scale.value = withSpring(1, theme.motion.spring.press);
      }}
      disabled={!isInteractive}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}
