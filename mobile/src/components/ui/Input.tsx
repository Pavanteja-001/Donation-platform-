import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  FadeIn,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../lib/theme";

type IconName = keyof typeof Feather.glyphMap;

/**
 * PRD Appendix A.4 — labelled input with prefix, icon and inline error slot.
 *
 * Idle state is a soft slate "well" that lifts to white on focus, with the border easing to teal
 * and a faint coloured glow. Animating fill *and* border gives focus a clear, calm target without
 * needing a heavy outline.
 *
 * Note: this component owns no outer margin. Spacing between fields belongs to the parent's
 * `gap`, so a form can space itself without fighting a hardcoded margin from inside.
 */
export function Input({
  label,
  prefix,
  icon,
  error,
  helper,
  style,
  containerStyle,
  onFocus,
  onBlur,
  multiline,
  ...props
}: TextInputProps & {
  label?: string;
  prefix?: string;
  icon?: IconName;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const focus = useSharedValue(0);
  const hasError = !!error;

  const animatedContainerStyle = useAnimatedStyle(() => {
    // An error outranks focus: a field that's wrong should stay visibly wrong while you fix it.
    const borderColor = hasError
      ? theme.color.danger
      : interpolateColor(focus.value, [0, 1], [theme.color.border, theme.color.primary]);

    const backgroundColor = hasError
      ? theme.color.dangerSoft
      : interpolateColor(focus.value, [0, 1], [theme.color.background, theme.color.surface]);

    return {
      borderColor,
      backgroundColor,
      shadowColor: hasError ? theme.color.danger : theme.color.primary,
      shadowOpacity: withTiming(focus.value * 0.14, { duration: theme.motion.fast }),
      shadowRadius: withTiming(focus.value * 8, { duration: theme.motion.fast }),
      shadowOffset: { width: 0, height: 2 },
      elevation: 0,
    };
  }, [hasError]);

  const iconColor = hasError ? theme.color.danger : isFocused ? theme.color.primary : theme.color.textTertiary;

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View style={[styles.inputContainer, multiline && styles.inputContainerMultiline, animatedContainerStyle]}>
        {icon && <Feather name={icon} size={17} color={iconColor} style={styles.icon} />}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}

        <TextInput
          style={[styles.input, (icon || prefix) && styles.inputWithAdornment, multiline && styles.inputMultiline, style]}
          placeholderTextColor={theme.color.textTertiary}
          selectionColor={theme.color.primary}
          multiline={multiline}
          onFocus={(e) => {
            setIsFocused(true);
            focus.value = withTiming(1, { duration: theme.motion.fast });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            focus.value = withTiming(0, { duration: theme.motion.fast });
            onBlur?.(e);
          }}
          {...props}
        />
      </Animated.View>

      {error ? (
        <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.messageRow}>
          <Feather name="alert-circle" size={12} color={theme.color.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : helper ? (
        <View style={styles.messageRow}>
          <Text style={styles.helperText}>{helper}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: theme.radii.md,
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
  },
  inputContainerMultiline: { alignItems: "flex-start", paddingVertical: theme.spacing.md },
  icon: { marginRight: theme.spacing.sm },
  prefix: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.color.textSecondary,
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: 15,
    fontWeight: "500",
    color: theme.color.textPrimary,
  },
  inputWithAdornment: { paddingLeft: 0 },
  inputMultiline: { minHeight: 88, textAlignVertical: "top", paddingTop: 0 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: theme.spacing.xs + 2 },
  errorText: { ...theme.typography.caption, color: theme.color.danger, fontWeight: "600", flex: 1 },
  helperText: { ...theme.typography.caption, color: theme.color.textTertiary, flex: 1 },
});
