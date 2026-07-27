import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../lib/theme";
import { Button } from "./Button";

type IconName = keyof typeof Feather.glyphMap;

// PRD Appendix A.5 — one of the four required states on every screen. An empty screen should
// still feel designed: an icon gives the eye somewhere to land instead of two lines of grey text
// floating in the middle of nothing.
export function EmptyState({
  title,
  subtitle,
  icon = "inbox",
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(theme.motion.slow)} style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={26} color={theme.color.textTertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" compact />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { ...theme.typography.h3, color: theme.color.textPrimary, textAlign: "center" },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.color.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    maxWidth: 280,
  },
  action: { marginTop: theme.spacing.xl },
});
