import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import type { AppNavigationProp, RootStackParamList } from "../navigation/types";

const TYPES: { route: keyof RootStackParamList; label: string; hint: string; icon: string }[] = [
  { route: "CreateMoney", label: "Money", hint: "Raise funds toward a target amount", icon: "dollar-sign" },
  { route: "CreateKit", label: "Kit", hint: "Grocery or education kits — funded or delivered", icon: "package" },
  { route: "CreateBlood", label: "Blood", hint: "Request a blood group, eligibility-matched", icon: "droplet" },
  { route: "CreateMealSlot", label: "Meal Slot", hint: "Sponsor specific calendar dates", icon: "calendar" },
  { route: "CreateGoods", label: "Goods", hint: "A specific item someone can claim and give", icon: "gift" },
  { route: "CreateSkillRequest", label: "Volunteer", hint: "Request skilled volunteers for a task or event", icon: "users" },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ChooserCard({ item, index }: { item: typeof TYPES[0]; index: number }) {
  const navigation = useNavigation<AppNavigationProp>();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <AnimatedPressable
        onPress={() => navigation.navigate(item.route as never)}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 15 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
        style={[styles.card, theme.elevation.level1, animatedStyle]}
      >
        <View style={styles.iconCircle}>
          <Feather name={item.icon as any} size={20} color={theme.color.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.hint}>{item.hint}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={theme.color.textSecondary} />
      </AnimatedPressable>
    </Animated.View>
  );
}

export function CreateNeedChooserScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>What do you need help with?</Text>
      <Text style={styles.subtitle}>Choose a category below to create your helper request.</Text>
      <View style={styles.listContainer}>
        {TYPES.map((t, idx) => (
          <ChooserCard key={t.route} item={t} index={idx} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  title: { ...theme.typography.h1, color: theme.color.textPrimary, marginBottom: 2 },
  subtitle: { ...theme.typography.caption, fontSize: 14, color: theme.color.textSecondary, marginBottom: theme.spacing.lg },
  listContainer: { gap: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius * 1.5,
    padding: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.color.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: { flex: 1 },
  label: { fontSize: 16, fontWeight: "700", color: theme.color.textPrimary },
  hint: { fontSize: 13, color: theme.color.textSecondary, marginTop: 2, lineHeight: 18, fontWeight: "500" },
});
