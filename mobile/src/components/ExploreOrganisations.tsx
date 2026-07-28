import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { Gradient } from "./Gradient";
import { IconPlate } from "./Depth";
import { PressableScale } from "./ui";
import type { AppNavigationProp } from "../navigation/types";

function ExploreCard({
  icon,
  title,
  subtitle,
  tone,
  delay,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  tone: "brand" | "blood";
  delay: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360)} style={styles.cardWrap}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.97}
        accessibilityLabel={`${title}. ${subtitle}`}
        style={[styles.card, theme.elevation.level2]}
      >
        <Gradient
          colors={theme.gradient.surfaceSheen}
          direction="diagonal"
          style={StyleSheet.absoluteFill as never}
          pointerEvents="none"
        />
        <IconPlate icon={icon} size="md" tone={tone} />
        <View style={styles.cardText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/**
 * The two organisation directories, as named destinations.
 *
 * These were icon-only buttons in the hero's action row, which put them beside Post a need and the
 * notification bell — company they don't belong in. Those are things you *do*; these are places
 * you *browse*, and a bare glyph can't say "orphanages and old age homes". Given a label and a
 * line of copy they also answer the question a donor actually has, which is what they'd go there
 * to do.
 *
 * They sit inside the feed's scrolling header rather than pinned: discoverable on the screen
 * everyone opens, gone once you're reading needs.
 */
export function ExploreOrganisations() {
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Explore organisations</Text>
      <View style={styles.row}>
        <ExploreCard
          icon="home"
          title="Homes"
          subtitle="Sponsor a meal at an orphanage or old age home"
          tone="brand"
          delay={40}
          onPress={() => navigation.navigate("Orphanages")}
        />
        <ExploreCard
          icon="users"
          title="NGOs"
          subtitle="See their work and offer to volunteer"
          tone="blood"
          delay={100}
          onPress={() => navigation.navigate("Ngos")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: theme.spacing.sm },
  sectionTitle: { ...theme.typography.overline, color: theme.color.textTertiary, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: theme.spacing.md },
  cardWrap: { flex: 1 },
  card: {
    // No `flex: 1` here. The wrapper has no resolved height of its own, so a flexed child collapses
    // to its padding and clips the plate — the card has to size to its own content.
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    padding: theme.spacing.md,
    overflow: "hidden",
  },
  cardText: { gap: 2 },
  title: { ...theme.typography.h3, color: theme.color.textPrimary },
  subtitle: { ...theme.typography.caption, color: theme.color.textSecondary, lineHeight: 16, minHeight: 32 },
});
