import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Avatar, Badge, Button, Card } from "../components/ui";
import type { AppNavigationProp } from "../navigation/types";

const TIER_LABEL: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold" };

// New in Chunk 2 (Milestone 9) — previously this identity/logout content lived directly in
// HomeScreen's custom header. Chunk 3 extends this into the full registration/edit profile
// screen (name/email/DOB/gender/blood group/permanent location); this chunk just gives it a
// real home as its own tab so nothing HomeScreen used to show is lost.
export function ProfileScreen() {
  const { user, trustTierInfo, signOut } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card elevated style={styles.identityCard}>
        <View style={styles.identityRow}>
          <Avatar name={user?.name} size={56} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{user?.name ?? "No name yet"}</Text>
            <Text style={styles.meta}>
              {user?.role} · {user?.phone}
            </Text>
          </View>
        </View>
        {trustTierInfo && (
          <View style={styles.tierRow}>
            <Badge label={`${TIER_LABEL[trustTierInfo.trustTier]} donor`} tone="primary" />
            <Text style={styles.tierMeta}>{trustTierInfo.confirmedContributionsCount} confirmed contributions</Text>
          </View>
        )}
      </Card>

      <View style={styles.section}>
        <Button label="Blood donor profile" variant="secondary" onPress={() => navigation.navigate("BloodProfile")} />
      </View>

      <View style={styles.section}>
        <Button label="Log out" variant="danger" onPress={() => signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  identityCard: { marginBottom: theme.spacing.lg },
  identityRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  identityText: { flex: 1 },
  name: { ...theme.typography.h2, color: theme.color.textPrimary },
  meta: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  tierMeta: { ...theme.typography.caption, color: theme.color.textSecondary },
  section: { marginBottom: theme.spacing.md },
});
