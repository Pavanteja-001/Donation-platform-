import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { theme } from "../../lib/theme";

// PRD Appendix A.4 — the selectable/filter chip already reimplemented ad hoc in several places
// (kit mode picker, blood-group picker, meal-slot date picker, status filters). One component,
// one visual language for all of them.
export function Chip({ label, active = false, onPress, disabled = false }: { label: string; active?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: "center",
  },
  chipActive: { borderColor: theme.color.primary, backgroundColor: theme.color.primary },
  disabled: { opacity: 0.5 },
  text: { fontSize: 13, fontWeight: "600", color: theme.color.textSecondary },
  textActive: { color: theme.color.onPrimary },
});
