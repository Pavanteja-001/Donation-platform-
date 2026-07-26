import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from "react-native-reanimated";
import { theme } from "../../lib/theme";

const AnimatedView = Animated.createAnimatedComponent(View);

// PRD Appendix A.4 — Labeled input with prefix support and inline error slot.
// Overhauled with Reanimated to animate border colors and a subtle focus glow.
export function Input({
  label,
  prefix,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string; prefix?: string; error?: string }) {
  const isFocused = useSharedValue(0);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      isFocused.value,
      [0, 1],
      [theme.color.border, theme.color.primary]
    );

    return {
      borderColor: error ? theme.color.danger : borderColor,
      // Subtle elevation/glow on focus for premium look
      shadowColor: theme.color.primary,
      shadowOpacity: withTiming(isFocused.value * 0.08, { duration: 150 }),
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: withTiming(isFocused.value * 3, { duration: 150 }),
    };
  });

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <AnimatedView style={[styles.inputContainer, animatedContainerStyle]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, prefix ? { paddingLeft: 0 } : { paddingLeft: theme.spacing.lg }, style]}
          placeholderTextColor={theme.color.textSecondary}
          onFocus={(e) => {
            isFocused.value = withTiming(1, { duration: 150 });
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            isFocused.value = withTiming(0, { duration: 150 });
            if (onBlur) onBlur(e);
          }}
          {...props}
        />
      </AnimatedView>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.md },
  label: { fontSize: 13, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.xs },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderRadius: theme.radius,
    minHeight: 48, // slightly increased for premium feel
    // iOS shadow settings container (Android elevation requires different config, but shadow properties are standard)
    elevation: 2,
  },
  prefix: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.color.textSecondary,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.xs,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    fontSize: 16,
    color: theme.color.textPrimary,
  },
  error: { color: theme.color.danger, fontSize: 12, marginTop: theme.spacing.xs },
});
