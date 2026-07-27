import { useEffect } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../lib/theme";
import { PressableScale } from "./PressableScale";

export type ButtonVariant = "primary" | "blood" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type IconName = keyof typeof Feather.glyphMap;

const SIZE = {
  sm: { minHeight: 40, paddingHorizontal: theme.spacing.lg, radius: theme.radii.md, fontSize: 13, icon: 15 },
  md: { minHeight: 50, paddingHorizontal: theme.spacing.xl, radius: theme.radii.lg, fontSize: 15, icon: 17 },
  lg: { minHeight: 56, paddingHorizontal: theme.spacing.xl, radius: theme.radii.lg, fontSize: 16, icon: 19 },
} as const;

// Fill, text and border per variant, in one table — so adding a variant is a data change rather
// than a new branch in the render body.
const VARIANT = {
  primary: { background: theme.color.primary, foreground: theme.color.onPrimary, border: "transparent" },
  blood: { background: theme.color.blood, foreground: theme.color.onBlood, border: "transparent" },
  secondary: { background: theme.color.surface, foreground: theme.color.primary, border: theme.color.borderStrong },
  ghost: { background: "transparent", foreground: theme.color.primary, border: "transparent" },
  danger: { background: theme.color.dangerSoft, foreground: theme.color.danger, border: "transparent" },
} as const;

// Filled variants get a lit ramp instead of one flat colour — same top-left light source as
// every other raised surface (Depth.tsx). Outline/ghost variants stay flat by design: they are
// *not* raised, and shading them would contradict that.
const VARIANT_RAMP: Partial<Record<ButtonVariant, readonly [string, string, ...string[]]>> = {
  primary: ["#D33B3B", "#B91C1C", "#8E1414"],
  blood: ["#B32A2A", "#991B1B", "#761010"],
};

/**
 * PRD Appendix A.4 — the one button every screen reaches for.
 *
 * `blood` is a first-class variant, not a colour override: emergency/blood CTAs are the only
 * place crimson is allowed to fill a button, and routing them through a named variant is what
 * keeps that rule enforceable rather than a convention people forget.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  fullWidth = false,
  compact = false,
  /** Coloured ambient glow. Reserve for the single most important CTA on a screen. */
  glow = false,
  style,
}: {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  loading?: boolean;
  /** Force stretch. Rarely needed — in a column the button already fills its parent. */
  fullWidth?: boolean;
  /** Shrink to fit its label, for inline/toolbar buttons. */
  compact?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const sizing = SIZE[size];
  const palette = VARIANT[variant];
  const ramp = VARIANT_RAMP[variant];
  const glowStyle = glow && !isDisabled ? (variant === "blood" || variant === "danger" ? theme.glow.blood : theme.glow.primary) : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          minHeight: sizing.minHeight,
          paddingHorizontal: sizing.paddingHorizontal,
          borderRadius: sizing.radius,
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderWidth: palette.border === "transparent" ? 0 : 1,
        },
        glowStyle,
        fullWidth && styles.fullWidth,
        compact && styles.compact,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {ramp && !isDisabled && (
        <>
          <LinearGradient
            colors={ramp}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: sizing.radius }]}
          />
          {/* Gloss across the top half only — the edge the light actually reaches. */}
          <LinearGradient
            colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0)"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.5, y: 0.9 }}
            style={[StyleSheet.absoluteFill, { borderRadius: sizing.radius }]}
          />
        </>
      )}

      {loading ? (
        <LoadingDots color={palette.foreground} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === "left" && <Feather name={icon} size={sizing.icon} color={palette.foreground} />}
          <Text style={[styles.label, { fontSize: sizing.fontSize, color: palette.foreground }]} numberOfLines={1}>
            {label}
          </Text>
          {icon && iconPosition === "right" && <Feather name={icon} size={sizing.icon} color={palette.foreground} />}
        </View>
      )}
    </PressableScale>
  );
}

/**
 * Three staggered pulsing dots instead of `ActivityIndicator`. The stock spinner is the single
 * most recognisable "unstyled app" tell, and it can't take the button's foreground colour
 * convincingly across platforms.
 */
function LoadingDots({ color }: { color: string }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <LoadingDot key={i} color={color} index={i} />
      ))}
    </View>
  );
}

function LoadingDot({ color, index }: { color: string; index: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      index * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: theme.motion.normal }),
          withTiming(0.3, { duration: theme.motion.normal })
        ),
        -1,
        true
      )
    );
  }, [index, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  // No `alignSelf` here on purpose: in a flex column the button inherits `stretch` and fills its
  // parent, which is what every existing screen already lays out against.
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  compact: { alignSelf: "flex-start" },
  content: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  label: { fontWeight: "700", letterSpacing: -0.2, textAlign: "center" },
  disabled: { opacity: 0.45 },
  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
