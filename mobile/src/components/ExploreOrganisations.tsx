import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { Gradient } from "./Gradient";
import { IconPlate } from "./Depth";
import { PressableScale } from "./ui";
import type { AppNavigationProp } from "../navigation/types";

function ExploreCard({
  icon,
  title,
  hint,
  tone,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  /** Not drawn — spoken. Taking the caption off the card shouldn't cost a screen-reader user it. */
  hint: string;
  tone: "brand" | "blood";
  onPress: () => void;
}) {
  return (
    <View style={styles.cardWrap}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.96}
        accessibilityLabel={`${title}. ${hint}`}
        style={[styles.card, theme.elevation.level2]}
      >
        <Gradient
          colors={theme.gradient.surfaceSheen}
          direction="diagonal"
          style={StyleSheet.absoluteFill as never}
          pointerEvents="none"
        />
        <IconPlate icon={icon} size="sm" tone={tone} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </PressableScale>
    </View>
  );
}

/**
 * The three browse destinations, fixed to the screen width.
 *
 * Icon and name only. Each destination introduces itself in its own header once you're there,
 * which is where the explanation is actually useful — repeating it on a ~100dp card is what forced
 * this row to scroll, and a row that scrolls hides whatever sits past the right edge.
 *
 * Sits inside the feed's scrolling header rather than pinned: present on the screen everyone
 * opens, out of the way once you're reading needs.
 */
export function ExploreOrganisations() {
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <View style={styles.row}>
      <ExploreCard
        icon="home"
        title="Homes"
        hint="Sponsor a meal at an orphanage or old age home"
        tone="brand"
        onPress={() => navigation.navigate("Orphanages")}
      />
      <ExploreCard
        icon="users"
        title="NGOs"
        hint="See their work and offer to volunteer"
        tone="blood"
        onPress={() => navigation.navigate("Ngos")}
      />
      <ExploreCard
        icon="package"
        title="Goods"
        hint="Give away what you don't use, or ask for what you need"
        tone="brand"
        onPress={() => navigation.navigate("Goods")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  // The wrapper takes its third of the width; the card must NOT also flex, or it collapses to its
  // own padding inside a wrapper that has no resolved height of its own.
  cardWrap: { flex: 1 },
  card: {
    // Icon and label on one line. Stacked, the plate and the text each claimed a row for a single
    // short word — side by side the card is only as tall as the plate itself.
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    paddingVertical: 7,
    paddingHorizontal: theme.spacing.xs,
    overflow: "hidden",
  },
  title: { fontSize: 12, lineHeight: 15, fontWeight: "800", color: theme.color.textPrimary },
});
