import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../lib/theme";
import { PressableScale } from "./PressableScale";

type IconName = keyof typeof Feather.glyphMap;

// PRD Appendix A.4 — selectable/filter chip.
export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
  icon,
  /** Selected-state colour. Blood/urgency filter rows tint crimson; everything else teal. */
  tone = "primary",
  count,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
  tone?: "primary" | "blood";
  count?: number;
}) {
  const activeColor = tone === "blood" ? theme.color.blood : theme.color.primary;
  const foreground = active ? theme.color.onPrimary : theme.color.textSecondary;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.94}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[
        styles.chip,
        active && { backgroundColor: activeColor, borderColor: activeColor },
        disabled && styles.disabled,
      ]}
    >
      {icon && <Feather name={icon} size={13} color={foreground} />}
      <Text style={[styles.text, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
      {typeof count === "number" && (
        <View style={[styles.count, active ? styles.countActive : styles.countIdle]}>
          <Text style={[styles.countText, { color: active ? theme.color.onPrimary : theme.color.textSecondary }]}>
            {count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs + 2,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 9,
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: theme.color.surface,
  },
  disabled: { opacity: 0.45 },
  text: { fontSize: 13, fontWeight: "700", letterSpacing: -0.1 },
  count: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: theme.radii.pill, alignItems: "center" },
  countIdle: { backgroundColor: theme.color.surfaceMuted },
  countActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  countText: { fontSize: 11, fontWeight: "800" },
});
