import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { theme } from "../../lib/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// PRD Appendix A.4 — Selectable/filter chip. Overhauled with Reanimated to ensure
// 60/120fps micro-interactions (press scaling) and consistent styling.
export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedPressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(0.94, { damping: 15, stiffness: 350 });
    }
  };

  const handlePressOut = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 350 });
    }
  };

  return (
    <AnimatedPressable
      style={[
        styles.chip,
        active && styles.chipActive,
        disabled && styles.disabled,
        animatedPressStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !onPress}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.color.surface,
  },
  chipActive: { borderColor: theme.color.primary, backgroundColor: theme.color.primary },
  disabled: { opacity: 0.5 },
  text: { fontSize: 13, fontWeight: "600", color: theme.color.textSecondary },
  textActive: { color: theme.color.onPrimary },
});
