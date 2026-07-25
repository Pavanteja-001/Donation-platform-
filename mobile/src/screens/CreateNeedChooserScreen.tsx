import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../lib/theme";
import type { AppNavigationProp, RootStackParamList } from "../navigation/types";

const TYPES: { route: keyof RootStackParamList; label: string; hint: string }[] = [
  { route: "CreateMoney", label: "Money", hint: "Raise funds toward a target amount" },
  { route: "CreateKit", label: "Kit", hint: "Grocery or education kits — funded or delivered" },
  { route: "CreateBlood", label: "Blood", hint: "Request a blood group, eligibility-matched" },
  { route: "CreateMealSlot", label: "Meal slot", hint: "Sponsor specific calendar dates" },
  { route: "CreateGoods", label: "Goods", hint: "A specific item someone can claim and give" },
];

// New in Chunk 2 (Milestone 9) — previously HomeScreen showed all 5 "+ Type" buttons in a
// cramped row above the feed at all times. A real chooser screen, reached via one "+" action,
// scales better as the type list grows and gives each option room to explain itself.
export function CreateNeedChooserScreen() {
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {TYPES.map((t) => (
        <TouchableOpacity key={t.route} style={styles.card} onPress={() => navigation.navigate(t.route as never)} activeOpacity={0.7}>
          <Text style={styles.label}>{t.label}</Text>
          <Text style={styles.hint}>{t.hint}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    minHeight: 44,
  },
  label: { ...theme.typography.bodyMedium, color: theme.color.textPrimary },
  hint: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
});
