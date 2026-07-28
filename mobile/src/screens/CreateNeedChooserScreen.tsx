import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { NeedType } from "../lib/api";
import { TYPE_META } from "../lib/needMeta";
import { IconPlate, litRamp } from "../components/Depth";
import { BloodBagIllustration, KitBoxIllustration, RupeeStackIllustration } from "../components/illustrations";
import { theme } from "../lib/theme";
import { PressableScale } from "../components/ui";
import type { AppNavigationProp, RootStackParamList } from "../navigation/types";

// Each entry pairs a route with its need type, so the icon and colour come from the shared
// TYPE_META table rather than being restated here — a MONEY need looks the same in the chooser,
// the feed and the detail screen.
const TYPES: { route: keyof RootStackParamList; type: NeedType; label: string; hint: string }[] = [
  { route: "CreateMoney", type: "MONEY", label: "Money", hint: "Raise funds toward a target amount" },
  { route: "CreateKit", type: "KIT", label: "Kit", hint: "Grocery or education kits — funded or delivered" },
  { route: "CreateBlood", type: "BLOOD", label: "Blood", hint: "Request a blood group, eligibility-matched" },
  { route: "CreateMealSlot", type: "MEAL_SLOT", label: "Meal slot", hint: "Sponsor specific calendar dates" },
  { route: "CreateGoods", type: "GOODS", label: "Goods", hint: "A specific item someone can claim and give" },
  { route: "CreateSkillRequest", type: "SKILL_REQUEST", label: "Volunteer", hint: "Request skilled volunteers for a task or event" },
];

function ChooserCard({ item, index }: { item: (typeof TYPES)[number]; index: number }) {
  const navigation = useNavigation<AppNavigationProp>();
  const meta = TYPE_META[item.type];

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(360)}>
      <PressableScale
        onPress={() => navigation.navigate(item.route as never)}
        scaleTo={0.98}
        accessibilityLabel={`${item.label}: ${item.hint}`}
        style={[styles.card, theme.elevation.level2]}
      >
        {item.type === "BLOOD" ? (
          <BloodBagIllustration size={44} fillLevel={0} />
        ) : item.type === "KIT" || item.type === "GOODS" ? (
          <KitBoxIllustration size={44} />
        ) : item.type === "MONEY" ? (
          <RupeeStackIllustration size={44} />
        ) : (
          <IconPlate icon={meta.icon} size="md" tone="custom" colors={litRamp(meta.color)} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.hint}>{item.hint}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={theme.color.textTertiary} />
      </PressableScale>
    </Animated.View>
  );
}

export function CreateNeedChooserScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
        <Text style={styles.title}>What do you need help with?</Text>
        <Text style={styles.subtitle}>Choose a category to create your request.</Text>
      </Animated.View>

      <View style={styles.list}>
        {TYPES.map((t, idx) => (
          <ChooserCard key={t.route} item={t} index={idx} />
        ))}
      </View>

      {/* PRD §6.3 — set the expectation before the form, not after submitting it. */}
      <Animated.View entering={FadeInDown.delay(TYPES.length * 60).duration(360)} style={styles.noticeBox}>
        <Feather name="shield" size={15} color={theme.color.info} />
        <Text style={styles.noticeText}>Every request is reviewed by an admin before it goes live to donors.</Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },

  header: { paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.sm, gap: theme.spacing.xs },
  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  subtitle: { ...theme.typography.bodySmall, color: theme.color.textSecondary },

  list: { gap: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  iconTile: { width: 46, height: 46, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center" },
  textContainer: { flex: 1, gap: 2 },
  label: { ...theme.typography.h3, color: theme.color.textPrimary },
  hint: { ...theme.typography.caption, color: theme.color.textSecondary, lineHeight: 17 },

  noticeBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.infoSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  noticeText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1, lineHeight: 17 },
});
