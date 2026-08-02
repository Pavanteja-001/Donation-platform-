import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { NeedType } from "../lib/api";
import {
  CATEGORIES,
  TYPE_ROUTES,
  TYPE_LABELS,
  TYPE_HINTS,
  type CategoryMeta,
  type NeedCategory,
} from "../lib/needCategory";
import { theme } from "../lib/theme";
import { PressableScale } from "../components/ui";
import type { AppNavigationProp } from "../navigation/types";

/**
 * Posting a need starts with the CAUSE, not the mechanism.
 *
 * The previous version asked "Money, Kit, Blood, Meal slot, Goods or Volunteer?" — which is the
 * platform's internal model, not a question a person in trouble can answer. Someone whose child
 * needs school fees knows it is about education; whether that becomes a MONEY need or a KIT need
 * is a detail they shouldn't have to translate.
 *
 * So: pick the cause, and only then pick how to receive help — and only when the cause actually
 * allows more than one way. Seven of the eleven categories have exactly one, so most posters
 * never see the second question at all.
 */

function CategoryCard({
  category,
  index,
  expanded,
  onPress,
}: {
  category: CategoryMeta;
  index: number;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityLabel={`${category.label}: ${category.hint}`}
        style={[styles.card, theme.elevation.level2, expanded && styles.cardExpanded]}
      >
        <Image source={category.icon} style={styles.icon} contentFit="contain" transition={120} />
        <View style={styles.textContainer}>
          <Text style={styles.label}>{category.label}</Text>
          <Text style={styles.hint}>{category.hint}</Text>
        </View>
        <Feather
          // A category with one option goes straight to the form; one with several opens in
          // place. Different arrows so the difference is visible before tapping.
          name={category.types.length > 1 ? (expanded ? "chevron-up" : "chevron-down") : "chevron-right"}
          size={20}
          color={theme.color.textTertiary}
        />
      </PressableScale>
    </Animated.View>
  );
}

function TypeOption({ type, onPick }: { type: NeedType; onPick: (type: NeedType) => void }) {
  return (
    <PressableScale onPress={() => onPick(type)} scaleTo={0.98} style={styles.typeRow}>
      <View style={styles.typeDot} />
      <View style={styles.textContainer}>
        <Text style={styles.typeLabel}>{TYPE_LABELS[type]}</Text>
        <Text style={styles.hint}>{TYPE_HINTS[type]}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.color.textTertiary} />
    </PressableScale>
  );
}

export function CreateNeedChooserScreen() {
  const navigation = useNavigation<AppNavigationProp>();
  const [openCategory, setOpenCategory] = useState<NeedCategory | null>(null);

  function goToForm(category: NeedCategory, type: NeedType) {
    const route = TYPE_ROUTES[type];
    if (!route) return;
    // The category rides along to the form so the need is filed under the tile the poster
    // actually chose — the server only infers it for types that admit exactly one cause.
    //
    // Cast because `navigate` is overloaded per route name, and TS can't narrow the params type
    // from a route held in a variable. `TYPE_ROUTES` only contains real route names, and every
    // one of them accepts `{ category }`, so the shape is checked where it's declared instead.
    (navigation.navigate as (name: string, params?: object) => void)(route, { category });
  }

  function handleCategoryPress(category: CategoryMeta) {
    if (category.types.length === 1) {
      goToForm(category.id, category.types[0]);
      return;
    }
    setOpenCategory((current) => (current === category.id ? null : category.id));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
        <Text style={styles.title}>What do you need help with?</Text>
        <Text style={styles.subtitle}>Pick the area your request is about.</Text>
      </Animated.View>

      <View style={styles.list}>
        {CATEGORIES.map((category, idx) => {
          const expanded = openCategory === category.id;
          return (
            <View key={category.id}>
              <CategoryCard
                category={category}
                index={idx}
                expanded={expanded}
                onPress={() => handleCategoryPress(category)}
              />
              {expanded && (
                <Animated.View entering={FadeIn.duration(180)} style={styles.typeGroup}>
                  <Text style={styles.typeGroupLabel}>How would you like to receive help?</Text>
                  {category.types.map((type) => (
                    <TypeOption key={type} type={type} onPick={(t) => goToForm(category.id, t)} />
                  ))}
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>

      {/* PRD §6.3 — set the expectation before the form, not after submitting it. */}
      <Animated.View entering={FadeInDown.delay(400).duration(360)} style={styles.noticeBox}>
        <Feather name="shield" size={15} color={theme.color.info} />
        <Text style={styles.noticeText}>Every request is reviewed by an admin before it goes live to donors.</Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg },
  header: { gap: theme.spacing.xs },
  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  subtitle: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  list: { gap: theme.spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    padding: theme.spacing.md,
  },
  // Square-bottomed while open so the card and the options below read as one block rather than
  // two stacked cards.
  cardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  icon: { width: 40, height: 40 },
  textContainer: { flex: 1, gap: 1 },
  label: { ...theme.typography.h3, color: theme.color.textPrimary },
  hint: { ...theme.typography.caption, color: theme.color.textSecondary },
  typeGroup: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.color.borderSubtle,
    borderBottomLeftRadius: theme.radii.xl,
    borderBottomRightRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  typeGroupLabel: {
    ...theme.typography.caption,
    color: theme.color.textTertiary,
    paddingVertical: theme.spacing.sm,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.primary, marginLeft: 4 },
  typeLabel: { ...theme.typography.bodyMedium, color: theme.color.textPrimary },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.infoSoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
  },
  noticeText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
});
