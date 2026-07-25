import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";
import { Button } from "./Button";

// PRD Appendix A.5 — the other required-but-missing state: today errors just render as a plain
// red <Text>, no way to retry without leaving the screen. This gives every screen a real
// "no raw error dumps, no dead-ends" story (Chunk 6/7).
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <View style={styles.action}>
          <Button label="Try again" onPress={onRetry} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  message: { color: theme.color.danger, fontSize: 14, textAlign: "center" },
  action: { marginTop: theme.spacing.lg },
});
