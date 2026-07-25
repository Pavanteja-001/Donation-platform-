import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "../../lib/theme";

// PRD Appendix A.3 — the standard surface container (border + radius + elevation) instead of
// every screen redefining the same three style properties.
export function Card({ children, style, elevated = false }: { children: ReactNode; style?: ViewStyle; elevated?: boolean }) {
  return <View style={[styles.card, elevated && theme.elevation.level1, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.spacing.lg,
  },
});
