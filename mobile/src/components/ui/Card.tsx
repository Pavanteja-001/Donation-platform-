import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../../lib/theme";
import { PressableScale } from "./PressableScale";

export type CardVariant = "flat" | "raised" | "hero";

/**
 * PRD Appendix A.3 — the standard floating surface.
 *
 * `raised` is the default look of the app: crisp white on the slate canvas, a hairline that
 * barely registers, and a wide soft shadow doing the actual separation work. `flat` is for
 * cards nested inside another card, where a second shadow would just muddy the stack.
 */
export function Card({
  children,
  style,
  variant = "raised",
  /** Back-compat with the previous API (`elevated` → `raised`). Prefer `variant`. */
  elevated,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  elevated?: boolean;
  onPress?: () => void;
}) {
  const resolved: CardVariant = elevated ? "raised" : variant;

  const surfaceStyle = [
    styles.card,
    resolved === "hero" && styles.hero,
    resolved === "raised" && theme.elevation.level2,
    resolved === "hero" && theme.elevation.level3,
    style,
  ];

  if (onPress) {
    // Cards are large, so they take a subtler scale than a button — a full 0.97 on a
    // full-width card reads as the whole screen lurching.
    return (
      <PressableScale onPress={onPress} scaleTo={0.985} style={surfaceStyle}>
        {children}
      </PressableScale>
    );
  }

  return <View style={surfaceStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
  },
  hero: {
    borderRadius: theme.radii.xxl,
    padding: theme.spacing.xl,
  },
});
