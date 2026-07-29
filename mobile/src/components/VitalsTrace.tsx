import { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

/**
 * A heartbeat trace sweeping across the back of an emergency card.
 *
 * The first attempt filled the card with liquid blood. It was literal to the point of being
 * grim, and worse, a rising opaque mass fought the white text sitting on top of it — the effect
 * competed with the words that actually carry the emergency.
 *
 * A monitor trace says the same thing without any of that: it reads as *a life being watched*
 * rather than as a container of blood, it's a hairline so nothing is ever obscured, and the sweep
 * gives the card motion that draws the eye from across the screen. It's the visual language of
 * every emergency room, which is exactly the register these cards are in.
 *
 * The waveform itself scrolls, and that is the only thing that moves.
 *
 * Two earlier attempts moved *light* over a stationary trace — first a hard-edged window
 * brightening the line beneath it, then a soft drifting band. Both flashed: a travelling edge is
 * a change in brightness, and the eye reads any repeating brightness change as a blink no matter
 * how it is feathered. Scrolling the line instead means nothing on the card ever changes
 * luminance. It just drifts, the way a real monitor's paper does.
 *
 * The trace is drawn twice as wide as the card with an even number of beats, so translating it by
 * exactly one card width lands on an identical phase — the loop has no seam and needs no fade.
 * Constant speed, no easing: eased motion on a loop reads as a throb.
 */

/**
 * One cardiac cycle as offsets from the baseline, in fractions of the segment width and of the
 * amplitude. Negative is upward (SVG y grows downward). Deliberately angular — a smoothed ECG
 * stops looking like an ECG.
 */
const BEAT: [number, number][] = [
  [0.0, 0],
  [0.22, 0],
  [0.28, -0.2], // P wave
  [0.34, 0],
  [0.44, 0],
  [0.47, 0.28], // Q
  [0.52, -1.0], // R — the spike
  [0.57, 0.5], // S
  [0.61, 0],
  [0.72, 0],
  [0.78, -0.32], // T wave
  [0.86, 0],
  [1.0, 0],
];

function tracePath(width: number, height: number, beats: number): string {
  const mid = height / 2;
  const amp = height * 0.3;
  const seg = width / beats;
  const points: string[] = [];

  for (let b = 0; b < beats; b++) {
    for (const [fx, fy] of BEAT) {
      // The first point of every later beat repeats the previous beat's last point, so skip it.
      if (b > 0 && fx === 0) continue;
      points.push(`${b === 0 && fx === 0 ? "M" : "L"}${(b + fx) * seg} ${mid + fy * amp}`);
    }
  }
  return points.join(" ");
}

/** Beats per card width. The drawn strip is twice this, so one loop = exactly one card width. */
const BEATS_PER_SCREEN = 2;

export function VitalsTrace({ tint = "#FF7A7A" }: { tint?: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
  }, [sweep]);

  const { width, height } = size;

  // Travels exactly one card width, which is one full repeat of the pattern — so the reset back
  // to 0 is invisible.
  const traceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -sweep.value * width }],
  }));

  function handleLayout(e: LayoutChangeEvent) {
    const next = e.nativeEvent.layout;
    if (next.width !== size.width || next.height !== size.height) {
      setSize({ width: next.width, height: next.height });
    }
  }

  const stripWidth = width * 2;
  const d = width > 0 ? tracePath(stripWidth, height, BEATS_PER_SCREEN * 2) : "";

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} onLayout={handleLayout} pointerEvents="none">
      {width > 0 && (
        <Animated.View style={traceStyle}>
          <Svg width={stripWidth} height={height}>
            <Path d={d} stroke={tint} strokeWidth={1.5} fill="none" opacity={0.24} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The strip is twice the card's width; without this it would paint over the neighbouring tile.
  clip: { overflow: "hidden" },
});
