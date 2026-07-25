import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { theme } from "../../lib/theme";

// PRD Appendix A.4 — labeled input with prefix support and inline error slot.
export function Input({
  label,
  prefix,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; prefix?: string; error?: string }) {
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, prefix ? { paddingLeft: 0 } : { paddingLeft: theme.spacing.lg }, style]}
          placeholderTextColor={theme.color.textSecondary}
          {...props}
        />
      </View>
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
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    minHeight: 44,
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
  inputError: { borderColor: theme.color.danger },
  error: { color: theme.color.danger, fontSize: 12, marginTop: theme.spacing.xs },
});
