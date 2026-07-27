import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";

/**
 * A real linear gradient.
 *
 * This used to be 32 stacked solid `View` bands, because `expo-linear-gradient` wasn't installed
 * and adding it forces a native rebuild (D-025). It is installed now, so this is the true
 * implementation — the props are deliberately unchanged, so every existing call site keeps
 * working. `bands` is accepted and ignored: nothing is quantised any more.
 *
 * Why it matters beyond smoothness: a genuine gradient can run at any angle, so surfaces can be
 * lit from a consistent direction (top-left) instead of reading as flat stacked strips.
 */
export function Gradient({
  colors = theme.gradient.brand,
  direction = "vertical",
  bands: _bands,
  style,
  children,
  pointerEvents,
  locations,
  angle,
}: {
  colors?: string[];
  /** "diagonal" lights the surface from the top-left, which is what gives it depth. */
  direction?: "vertical" | "horizontal" | "diagonal";
  /** @deprecated Accepted for call-site compatibility; a real gradient has no bands. */
  bands?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Pass "none" when used as an overlay/scrim so it never swallows touches beneath it. */
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
  /** Optional stop positions (0–1), one per colour. */
  locations?: number[];
  /** Custom start/end pair, overriding `direction`. */
  angle?: { start: { x: number; y: number }; end: { x: number; y: number } };
}) {
  const axis =
    angle ??
    (direction === "horizontal"
      ? { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } }
      : direction === "diagonal"
        ? { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }
        : { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } });

  // `colors` is a plain string[] at every call site; expo-linear-gradient's type wants a
  // readonly tuple of at least two entries, hence the cast (a one-colour array still renders).
  const stops = (colors.length === 1 ? [colors[0], colors[0]] : colors) as unknown as readonly [
    string,
    string,
    ...string[],
  ];

  return (
    <View style={style} pointerEvents={pointerEvents}>
      <LinearGradient
        colors={stops}
        locations={locations as never}
        start={axis.start}
        end={axis.end}
        style={styles.fill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
