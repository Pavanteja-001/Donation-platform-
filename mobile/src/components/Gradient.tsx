import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../lib/theme";

/** Parses "#RGB", "#RRGGBB" or "rgba(r,g,b,a)" into RGBA components. */
function parseColor(input: string): { r: number; g: number; b: number; a: number } {
  const value = input.trim();

  if (value.startsWith("rgba") || value.startsWith("rgb")) {
    const parts = value
      .slice(value.indexOf("(") + 1, value.lastIndexOf(")"))
      .split(",")
      .map((p) => parseFloat(p.trim()));
    return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
  }

  let hex = value.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(hex, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: 1 };
}

/**
 * A linear gradient built from stacked solid bands.
 *
 * `expo-linear-gradient` is not installed, and adding it would force a native prebuild. At these
 * band counts the steps are imperceptible on the large, low-contrast washes we use it for
 * (hero panels, scrims), so this buys the reference design's look for zero dependency cost.
 *
 * If a true gradient is ever needed — small elements, high-contrast stops, or animated stops —
 * swap this implementation for `expo-linear-gradient` and every call site keeps working.
 */
export function Gradient({
  colors = theme.gradient.brand,
  direction = "vertical",
  bands = 32,
  style,
  children,
  pointerEvents,
}: {
  colors?: string[];
  direction?: "vertical" | "horizontal";
  /** More bands = smoother, at one View each. 32 is smooth for full-screen washes. */
  bands?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Pass "none" when used as an overlay/scrim so it never swallows touches beneath it. */
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
}) {
  const stops = useMemo(() => colors.map(parseColor), [colors]);

  const strips = useMemo(() => {
    if (stops.length === 0) return [];
    if (stops.length === 1) {
      const only = stops[0];
      return [`rgba(${only.r},${only.g},${only.b},${only.a})`];
    }

    return Array.from({ length: bands }).map((_, i) => {
      // Position of this band across the whole gradient, mapped onto the stop pairs.
      const t = i / (bands - 1);
      const segment = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
      const local = t * (stops.length - 1) - segment;

      const from = stops[segment];
      const to = stops[segment + 1];
      const lerp = (a: number, b: number) => Math.round(a + (b - a) * local);

      const r = lerp(from.r, to.r);
      const g = lerp(from.g, to.g);
      const b = lerp(from.b, to.b);
      const a = from.a + (to.a - from.a) * local;

      return `rgba(${r},${g},${b},${a})`;
    });
  }, [stops, bands]);

  return (
    <View style={style} pointerEvents={pointerEvents}>
      <View
        style={[styles.fill, direction === "vertical" ? styles.column : styles.row]}
        pointerEvents="none"
      >
        {strips.map((color, i) => (
          <View key={i} style={[styles.band, { backgroundColor: color }]} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" },
  column: { flexDirection: "column" },
  row: { flexDirection: "row" },
  // Bands share the axis evenly; `flex: 1` on each means no seams from rounding.
  band: { flex: 1 },
});
