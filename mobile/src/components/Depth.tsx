import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";

/**
 * Depth primitives.
 *
 * One rule holds all of them together: **the light comes from the top-left.** A raised surface
 * is brightest at its top-left edge, its own colour in the middle, and darkest at the
 * bottom-right, with a warm shadow cast down-right. A recessed surface is the exact inverse.
 * Applying that consistently is what makes a flat screen read as dimensional — far more than
 * any single effect does.
 */

type PlateTone = "brand" | "blood" | "neutral" | "custom";
type PlateSize = "sm" | "md" | "lg";

const SIZES: Record<PlateSize, { box: number; icon: number; radius: number }> = {
  sm: { box: 32, icon: 14, radius: 11 },
  md: { box: 44, icon: 19, radius: 15 },
  lg: { box: 58, icon: 24, radius: 19 },
};

const TONE_FILL: Record<Exclude<PlateTone, "custom">, string[]> = {
  brand: theme.gradient.plateBrand,
  blood: ["#C7383A", "#991B1B", "#6E0F0F"],
  neutral: theme.gradient.plateNeutral,
};

/**
 * Builds a lit → shaded ramp from one flat brand colour, so any of the seven need-type colours
 * can be a raised plate without hand-authoring three stops each.
 */
export function litRamp(hex: string): string[] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const shift = (amount: number) => {
    const mix = (channel: number) =>
      Math.max(0, Math.min(255, Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount))));
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  };

  return [shift(0.22), hex, shift(-0.26)];
}

/**
 * A raised, lit tile holding an icon — the single biggest upgrade over a flat tinted square.
 *
 * Four layers, cheap enough for a list row: gradient fill (lit top-left → shaded bottom-right),
 * a gloss arc across the top half, a hairline rim that catches the light, and a warm cast
 * shadow. Nothing animates, so it costs nothing on scroll.
 */
export function IconPlate({
  icon,
  tone = "brand",
  size = "md",
  colors,
  iconColor,
  style,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  tone?: PlateTone;
  size?: PlateSize;
  /** Only read when `tone="custom"` — a 2–3 stop ramp, lightest first. */
  colors?: string[];
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const dims = SIZES[size];
  const fill = tone === "custom" ? (colors ?? TONE_FILL.brand) : TONE_FILL[tone];
  const isNeutral = tone === "neutral";
  const resolvedIconColor = iconColor ?? (isNeutral ? theme.color.primary : "#FFFFFF");

  return (
    <View
      style={[
        { width: dims.box, height: dims.box, borderRadius: dims.radius },
        styles.plateShadow,
        isNeutral && styles.plateShadowSoft,
        style,
      ]}
    >
      <LinearGradient
        colors={fill as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: dims.radius }]}
      />
      {/* Gloss: a highlight sitting on the top half only, fading out before the midpoint. */}
      <LinearGradient
        colors={theme.gradient.gloss as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.6, y: 0.85 }}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: dims.radius, opacity: isNeutral ? 0.75 : 0.55 },
        ]}
      />
      {/* Rim: brighter at the lit edge, so the tile has a physical border rather than a cut-out. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.rim,
          { borderRadius: dims.radius, borderColor: isNeutral ? "rgba(124,45,45,0.10)" : "rgba(255,255,255,0.32)" },
        ]}
      />
      <View style={styles.plateCenter}>
        <Feather name={icon} size={dims.icon} color={resolvedIconColor} />
      </View>
    </View>
  );
}

/**
 * A white card that is actually lit, rather than a white rectangle with a shadow.
 *
 * The sheen is a top-left → bottom-right wash at ~3% strength: invisible as an effect, but it
 * gives the surface a direction, which is what stops a screen full of cards reading as paper
 * cut-outs. `raised` picks the elevation step.
 */
export function DepthCard({
  children,
  raised = 2,
  radius = theme.radii.xl,
  style,
  sheen = true,
}: {
  children?: ReactNode;
  raised?: 1 | 2 | 3 | 4;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  sheen?: boolean;
}) {
  const elevation =
    raised === 1
      ? theme.elevation.level1
      : raised === 2
        ? theme.elevation.level2
        : raised === 3
          ? theme.elevation.level3
          : theme.elevation.level4;

  return (
    <View style={[styles.card, { borderRadius: radius }, elevation, style]}>
      {sheen && (
        <LinearGradient
          colors={theme.gradient.surfaceSheen as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

/**
 * A hairline that reads as an edge catching the light: bright on top, shadowed underneath.
 * Use instead of a 1px border on large separating surfaces (sheet tops, sticky headers).
 */
export function LitEdge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.85)", "rgba(124,45,45,0.10)"] as unknown as readonly [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.litEdge, style]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  plateShadow: {
    overflow: "hidden",
    shadowColor: "#6E0F0F",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 9,
    elevation: 6,
  },
  // A pale plate casting a strong crimson shadow looks dirty — keep it light and neutral.
  plateShadowSoft: {
    shadowColor: "#3B0A0A",
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 3,
  },
  rim: { borderWidth: StyleSheet.hairlineWidth * 2 },
  plateCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderSubtle,
    overflow: "hidden",
  },
  litEdge: { height: 2, width: "100%" },
});
