import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { isMoneyPayload, num } from "../lib/needMeta";
import { BlurView } from "expo-blur";
import { Gradient } from "./Gradient";
import { AnimatedCounter } from "./AnimatedCounter";
import { DonorsIllustration, RupeeStackIllustration, UrgentPulseIllustration } from "./illustrations";
import { useCreateNeedFlow, useForumFlow } from "./CreateNeedAction";
import { Avatar, PressableScale } from "./ui";

function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** First name only — a full legal name wraps and reads like a form field, not a greeting. */
function firstName(name: string | null | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

/**
 * One translucent stat card.
 *
 * The blur is the point: it samples the crimson→charcoal hero behind it, so the card picks up
 * the gradient instead of being a grey rectangle painted on top. `intensity` stays low — a heavy
 * blur over a dark wash turns to mud, and the gradient overlay + hairline are what actually
 * define the card's edges.
 *
 * `pulse` breathes the card when something needs attention now. It's a slow 1.8s cycle on
 * opacity and scale — fast enough to notice at a glance, slow enough not to nag while reading.
 */
function GlassStat({
  illustration,
  value,
  label,
  pulse = false,
}: {
  illustration: ReactNode;
  value: ReactNode;
  label: string;
  pulse?: boolean;
}) {
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (!pulse) {
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
  }, [pulse, breathe]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.03 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + breathe.value * 0.45,
  }));

  return (
    <Animated.View style={[styles.glassCard, pulse && pulseStyle]}>
      <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
      <Gradient colors={theme.gradient.glass} direction="diagonal" style={StyleSheet.absoluteFill as never} />
      {pulse && <Animated.View style={[styles.urgentGlow, glowStyle]} pointerEvents="none" />}
      <View style={styles.glassInner}>
        {illustration}
        {value}
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

function GlassButton({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.9} accessibilityLabel={label} style={styles.glassButton}>
      <Feather name={icon} size={18} color="#FFFFFF" />
    </PressableScale>
  );
}

/**
 * The crimson header the Live Needs feed opens with.
 *
 * Replaces the stock navigation header on this tab (see TabNavigator) rather than sitting under
 * it — two stacked headers would eat a third of the screen. It scrolls away with the list as the
 * feed's ListHeaderComponent, which is why the filter chips travel with it.
 *
 * The counters exist to show momentum: donors give to something that is visibly moving, and a
 * feed that opens on a static chip row communicates nothing about scale.
 */
export function FeedHero({ needs }: { needs: Need[] }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const openCreate = useCreateNeedFlow();
  const openForum = useForumFlow();

  const stats = useMemo(() => {
    const raised = needs.reduce(
      (sum, n) => (isMoneyPayload(n.payload) ? sum + num(n.payload.raised_amount) : sum),
      0
    );
    return {
      raised,
      live: needs.length,
      urgent: needs.filter((n) => n.urgency === "EMERGENCY" || n.urgency === "URGENT").length,
    };
  }, [needs]);

  // Deep red falling into charcoal, on the diagonal — a vertical red→black wash reads as a flat
  // block, while the charcoal end gives the glass cards something to sample.
  return (
    <Gradient
      colors={theme.gradient.heroDeep}
      direction="diagonal"
      style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}
    >
      <View style={styles.topRow}>
        <Avatar name={user?.name} photoUrl={user?.profilePhotoUrl} size={46} />

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greetingFor()},</Text>
          <Text style={styles.name} numberOfLines={1}>
            {firstName(user?.name)}
          </Text>
        </View>

        <View style={styles.actions}>
          <GlassButton icon="message-circle" onPress={openForum} label="Community forum" />
          <GlassButton icon="plus" onPress={openCreate} label="Post a need" />
        </View>
      </View>

      {/* Three separate glass cards rather than one dark strip with dividers. Each one is a real
          BlurView over the hero gradient, so the wash actually shows through and shifts as the
          card moves — a flat translucent rectangle can't do that. */}
      <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.statsStrip}>
        <GlassStat
          illustration={<RupeeStackIllustration size={34} />}
          value={<AnimatedCounter value={stats.raised} prefix="₹" style={styles.statValue} />}
          label="raised"
        />
        <GlassStat
          illustration={<DonorsIllustration size={34} />}
          value={<AnimatedCounter value={stats.live} style={styles.statValue} />}
          label="live needs"
        />
        <GlassStat
          illustration={<UrgentPulseIllustration size={34} />}
          value={<AnimatedCounter value={stats.urgent} style={styles.statValue} />}
          label="need help now"
          pulse={stats.urgent > 0}
        />
      </Animated.View>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radii.xxxl,
    borderBottomRightRadius: theme.radii.xxxl,
    overflow: "hidden",
  },

  topRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  greetingBlock: { flex: 1 },
  greeting: { ...theme.typography.caption, color: "rgba(255,255,255,0.72)" },
  name: { ...theme.typography.h2, color: "#FFFFFF" },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
  glassButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  chipRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  glassChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
  },
  glassChipText: { ...theme.typography.overline, color: "#FFFFFF", textTransform: "uppercase" },

  statsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  glassCard: {
    flex: 1,
    borderRadius: theme.radii.lg,
    // `overflow: hidden` is load-bearing here — without it the BlurView paints past the rounded
    // corners on Android and the card reads as a square.
    overflow: "hidden",
    borderWidth: 1,
    // Brighter on top-left than bottom-right would be ideal, but RN borders are uniform; a single
    // light hairline still reads as a lit glass edge against the dark wash.
    borderColor: "rgba(255,255,255,0.20)",
  },
  glassInner: {
    alignItems: "center",
    gap: 2,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  urgentGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(239,68,68,0.28)",
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 19, lineHeight: 24, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.4, textAlign: "center" },
  statLabel: { ...theme.typography.caption, color: "rgba(255,255,255,0.72)", fontSize: 11 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.18)" },
});
