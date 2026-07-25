import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { theme } from "../../lib/theme";

// PRD Appendix A.4 — labeled input with an inline error slot, so "real form validation with
// inline messages" (Chunk 6) has one place to render into instead of every screen inventing its
// own error <Text>.
export function Input({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={theme.color.textSecondary}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.md },
  label: { fontSize: 13, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.xs },
  input: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.color.textPrimary,
    minHeight: 44,
  },
  inputError: { borderColor: theme.color.danger },
  error: { color: theme.color.danger, fontSize: 12, marginTop: theme.spacing.xs },
});
