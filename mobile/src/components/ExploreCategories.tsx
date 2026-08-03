import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { CATEGORIES, type NeedCategory } from "../lib/needCategory";
import { theme } from "../lib/theme";
import { PressableScale } from "./ui";
import type { AppNavigationProp } from "../navigation/types";

/**
 * The category grid on the home screen — the donor-side counterpart to the post-a-need chooser.
 *
 * Four tiles across on purpose: a 3-column grid leaves the eleventh tile alone on its own row,
 * and a 2-column one pushes the needs feed a full screen further down. Eleven divides into four
 * rows of 4/4/3, which reads as a deliberate grid rather than a leftover.
 */

const COMMUNITY_ICON = require("../../assets/icons/community.webp");
const NGOS_ICON = require("../../assets/icons/ngos.webp");

/**
 * Three tiles lead somewhere better than a filtered feed, because that place already exists and
 * does more:
 *   - Donate items → the Goods screen, which splits "giving away" from "asking for"
 *   - Orphanages   → the homes directory, where you pick a home and then a date
 *   - NGOs         → the organisation directory; not a kind of need at all
 * The rest open the feed filtered to that cause.
 */
const DIRECT_ROUTES: Partial<Record<NeedCategory, "Goods" | "Orphanages">> = {
  DONATE_ITEMS: "Goods",
  ORPHANAGES: "Orphanages",
};

export function ExploreCategories() {
  const navigation = useNavigation<AppNavigationProp>();

  function open(category: NeedCategory) {
    const direct = DIRECT_ROUTES[category];
    if (direct) {
      navigation.navigate(direct);
      return;
    }
    navigation.navigate("CategoryNeeds", { category });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>EXPLORE BY CATEGORY</Text>

      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <PressableScale
            key={c.id}
            onPress={() => open(c.id)}
            scaleTo={0.94}
            accessibilityLabel={`${c.label}: ${c.hint}`}
            style={styles.tile}
          >
            <View style={styles.iconWrap}>
              <Image source={c.icon} style={styles.icon} contentFit="contain" transition={120} />
            </View>
            {/* Two lines allowed: "Women empowerment" and "Disaster relief" don't fit on one at
                this width, and truncating them to "Women empow…" reads as a bug. */}
            <Text style={styles.label} numberOfLines={2}>
              {c.label}
            </Text>
          </PressableScale>
        ))}

        {/* Community Q&A forum tile */}
        <PressableScale
          onPress={() => navigation.navigate("Forum")}
          scaleTo={0.94}
          accessibilityLabel="Community: Ask and answer"
          style={styles.tile}
        >
          <View style={styles.iconWrap}>
            <Image source={COMMUNITY_ICON} style={styles.communityIcon} contentFit="contain" transition={120} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            Community
          </Text>
        </PressableScale>

        {/* NGOs isn't a category — no need is ever filed under it. It's here because the design
            puts it in this grid and because it's where a donor looks for organisations, so it
            navigates to the directory instead of filtering the feed. */}
        <PressableScale
          onPress={() => navigation.navigate("Ngos")}
          scaleTo={0.94}
          accessibilityLabel="NGOs: verified organisations"
          style={styles.tile}
        >
          <View style={styles.iconWrap}>
            <Image source={NGOS_ICON} style={styles.icon} contentFit="contain" transition={120} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            NGOs
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
  sectionTitle: {
    ...theme.typography.caption,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: theme.color.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: theme.spacing.md },
  // 25% flat rather than flex, so the last row's three tiles line up under the first row's three
  // instead of stretching to fill the width.
  tile: { width: "25%", alignItems: "center", paddingHorizontal: 2, gap: 6 },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 32, height: 32 },
  communityIcon: { width: 48, height: 48 },
  label: {
    ...theme.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: theme.color.textPrimary,
    textAlign: "center",
  },
});
