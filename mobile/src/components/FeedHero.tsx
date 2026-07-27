import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatBloodGroup, isMoneyPayload, num } from "../lib/needMeta";
import { Gradient } from "./Gradient";
import { AnimatedCounter } from "./AnimatedCounter";
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

  const city = user?.city;

  return (
    <Gradient colors={theme.gradient.brand} style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}>
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

      <View style={styles.chipRow}>
        {user?.bloodGroup && (
          <View style={styles.glassChip}>
            <Feather name="droplet" size={11} color="#FFFFFF" />
            <Text style={styles.glassChipText}>{formatBloodGroup(user.bloodGroup)}</Text>
          </View>
        )}
        {city && (
          <View style={styles.glassChip}>
            <Feather name="map-pin" size={11} color="#FFFFFF" />
            <Text style={styles.glassChipText}>{city}</Text>
          </View>
        )}
      </View>

      <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.statsStrip}>
        <View style={styles.stat}>
          <AnimatedCounter value={stats.raised} prefix="₹" style={styles.statValue} />
          <Text style={styles.statLabel}>raised</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <AnimatedCounter value={stats.live} style={styles.statValue} />
          <Text style={styles.statLabel}>live needs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <AnimatedCounter value={stats.urgent} style={styles.statValue} />
          <Text style={styles.statLabel}>need help now</Text>
        </View>
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
    alignItems: "center",
    marginTop: theme.spacing.xl,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: theme.radii.xl,
    paddingVertical: theme.spacing.lg,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 19, lineHeight: 24, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.4, textAlign: "center" },
  statLabel: { ...theme.typography.caption, color: "rgba(255,255,255,0.66)", fontSize: 11 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.18)" },
});
