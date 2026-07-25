import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";
import { Button } from "./Button";

// PRD Appendix A.5 — one of the four required states on every screen. Most list screens today
// (Chunk 7 will migrate them) just render a bare "You haven't posted anything yet" <Text>; this
// gives that pattern a real, consistent shape with an optional call to action.
export function EmptyState({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  title: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, textAlign: "center" },
  subtitle: { ...theme.typography.caption, color: theme.color.textSecondary, textAlign: "center", marginTop: theme.spacing.xs },
  action: { marginTop: theme.spacing.lg },
});
