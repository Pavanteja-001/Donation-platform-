import { ActivityIndicator, Pressable, StyleSheet, Text, type GestureResponderEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { theme } from "../../lib/theme";

export type ButtonVariant = "primary" | "secondary" | "danger";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// PRD Appendix A.4 — The one button component every screen should reach for.
// Overhauled with Reanimated to ensure 60/120fps micro-interactions (press scaling).
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (!isDisabled) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  return (
    <AnimatedPressable
      style={[styles.base, styles[variant], isDisabled && styles.disabled, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? theme.color.primary : theme.color.onPrimary} />
      ) : (
        <Text style={[styles.label, textStyles[variant]]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: { backgroundColor: theme.color.primary },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.color.primary },
  danger: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.color.danger },
  disabled: { opacity: 0.5 },
  label: { ...theme.typography.bodyMedium },
});

const textStyles = StyleSheet.create({
  primary: { color: theme.color.onPrimary },
  secondary: { color: theme.color.primary },
  danger: { color: theme.color.danger },
});
