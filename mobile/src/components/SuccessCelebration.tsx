import { useEffect, useMemo } from "react";
import { Modal, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { Gradient } from "./Gradient";
import { Button } from "./ui";

// Crimson + gold leads, with green and blue as supporting colour. Now that crimson is the brand
// (D-025) rather than a danger-only signal, celebrating in it is on-brand — and red-and-gold is
// the festive pairing this audience reads as celebration.
const CONFETTI_COLORS = [
  theme.color.primary,
  theme.color.accent,
  theme.color.primaryBright,
  theme.color.success,
  theme.color.accent,
  theme.color.info,
];

const PIECE_COUNT = 26;

/**
 * The post-contribution moment. Replaces a bare `Alert.alert()` — the emotional peak of the whole
 * app was a system dialog.
 *
 * Built from plain Views on Reanimated rather than a confetti library, so it costs no new
 * dependency and no native rebuild.
 */
export function SuccessCelebration({
  visible,
  title,
  message,
  onDismiss,
  actionLabel = "Done",
}: {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.backdrop}>
        {visible && <ConfettiField />}
        {visible && <SuccessCard title={title} message={message} onDismiss={onDismiss} actionLabel={actionLabel} />}
      </View>
    </Modal>
  );
}

function SuccessCard({
  title,
  message,
  onDismiss,
  actionLabel,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
  actionLabel: string;
}) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: theme.motion.normal });
    scale.value = withSpring(1, theme.motion.spring.gentle);
    // The tick lands a beat after the card, so the eye is already there to see it arrive.
    checkScale.value = withDelay(140, withSpring(1, theme.motion.spring.bouncy));
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(checkScale);
    };
  }, [scale, opacity, checkScale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View style={[styles.card, theme.elevation.level3, cardStyle]}>
      <Animated.View style={[styles.checkCircle, checkStyle]}>
        {/* This is the payoff moment of every donation flow — a lit green dome with its own glow
            rather than a flat circle, matching the thank-you panel on the need detail screen. */}
        <Gradient
          colors={["#34D399", "#0E9F6E", "#07684A"]}
          direction="diagonal"
          style={StyleSheet.absoluteFill as never}
          pointerEvents="none"
        />
        <Gradient
          colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]}
          angle={{ start: { x: 0.2, y: 0 }, end: { x: 0.6, y: 0.85 } }}
          style={StyleSheet.absoluteFill as never}
          pointerEvents="none"
        />
        <Feather name="check" size={34} color={theme.color.onPrimary} />
      </Animated.View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <View style={styles.action}>
        <Button label={actionLabel} onPress={onDismiss} fullWidth />
      </View>
    </Animated.View>
  );
}

function ConfettiField() {
  const { width, height } = useWindowDimensions();

  // Randomised once per mount so every celebration looks slightly different.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }).map((_, i) => ({
        id: i,
        x: Math.random() * width,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 7,
        delay: Math.random() * 380,
        drift: (Math.random() - 0.5) * 140,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        duration: 1900 + Math.random() * 900,
        rounded: Math.random() > 0.55,
      })),
    [width]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} {...p} fallTo={height + 60} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  x,
  color,
  size,
  delay,
  drift,
  spin,
  duration,
  rounded,
  fallTo,
}: {
  x: number;
  color: string;
  size: number;
  delay: number;
  drift: number;
  spin: number;
  duration: number;
  rounded: boolean;
  fallTo: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(progress);
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-40, fallTo]) },
      { translateX: interpolate(progress.value, [0, 1], [0, drift]) },
      { rotate: `${progress.value * spin}deg` },
    ],
    // Holds full opacity for most of the fall, then fades out near the bottom.
    opacity: interpolate(progress.value, [0, 0.08, 0.75, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          left: x,
          width: size,
          height: size * (rounded ? 1 : 1.7),
          backgroundColor: color,
          borderRadius: rounded ? size / 2 : 2,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xxl,
    padding: theme.spacing.xxl,
    alignItems: "center",
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: theme.color.success,
    shadowColor: "#07684A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xl,
  },
  title: { ...theme.typography.h2, color: theme.color.textPrimary, textAlign: "center" },
  message: {
    ...theme.typography.bodySmall,
    color: theme.color.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
  action: { alignSelf: "stretch", marginTop: theme.spacing.xl },
  confetti: { position: "absolute", top: 0 },
});
