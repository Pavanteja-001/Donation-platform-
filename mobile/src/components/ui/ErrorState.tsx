import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../lib/theme";
import { Button } from "./Button";

// PRD Appendix A.5 — the other required-but-missing state: no raw error dumps, no dead-ends.
export function ErrorState({
  message,
  onRetry,
  title = "Something went wrong",
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(theme.motion.slow)} style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name="alert-triangle" size={26} color={theme.color.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {/* The raw message stays visible but secondary — useful when it's actionable ("no network"),
          never the loudest thing on screen. */}
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <View style={styles.action}>
          <Button label="Try again" icon="refresh-cw" onPress={onRetry} variant="secondary" compact />
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
    backgroundColor: theme.color.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { ...theme.typography.h3, color: theme.color.textPrimary, textAlign: "center" },
  message: {
    ...theme.typography.bodySmall,
    color: theme.color.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    maxWidth: 280,
  },
  action: { marginTop: theme.spacing.xl },
});
