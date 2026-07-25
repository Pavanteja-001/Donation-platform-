import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type GestureResponderEvent } from "react-native";
import { theme } from "../../lib/theme";

export type ButtonVariant = "primary" | "secondary" | "danger";

// PRD Appendix A.4 — the one button component every screen should reach for instead of
// hand-rolling TouchableOpacity + StyleSheet each time (as most existing screens still do —
// Chunk 7 refactors those; this chunk just establishes the component).
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
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? theme.color.primary : theme.color.onPrimary} />
      ) : (
        <Text style={[styles.label, textStyles[variant]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
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
