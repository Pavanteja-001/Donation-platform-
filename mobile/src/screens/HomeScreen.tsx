import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import type { Need } from "../lib/api";
import { NeedsFeedScreen } from "./NeedsFeedScreen";
import { MyNeedsScreen } from "./MyNeedsScreen";
import { NeedDetailScreen } from "./NeedDetailScreen";
import { CreateMoneyNeedScreen } from "./CreateMoneyNeedScreen";

// No routing library yet (kept minimal for Milestone 0-2) — a simple local view switch is
// enough for feed / my-needs / detail / create. Revisit once the app has enough screens to
// need real nav.
type Screen = { name: "feed" } | { name: "mine" } | { name: "detail"; needId: string } | { name: "create" };

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: "feed" });
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSelectNeed(need: Need) {
    setScreen({ name: "detail", needId: need.id });
  }

  function backToFeed() {
    setScreen({ name: "feed" });
    setRefreshKey((k) => k + 1); // force a refetch so any status changes show up
  }

  function backToMine() {
    setScreen({ name: "mine" });
    setRefreshKey((k) => k + 1);
  }

  if (screen.name === "detail") {
    // Whichever tab isn't known here, so just go back to the feed — good enough for now.
    return <NeedDetailScreen needId={screen.needId} onBack={backToFeed} />;
  }
  if (screen.name === "create") {
    return <CreateMoneyNeedScreen onBack={() => setScreen({ name: "feed" })} onDone={backToMine} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi{user?.name ? `, ${user.name}` : ""} 👋</Text>
          <Text style={styles.role}>
            {user?.role} · {user?.phone}
          </Text>
        </View>
        <TouchableOpacity onPress={() => signOut()}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={styles.tab} onPress={() => setScreen({ name: "feed" })}>
          <Text style={[styles.tabText, screen.name === "feed" && styles.tabTextActive]}>Live needs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setScreen({ name: "mine" })}>
          <Text style={[styles.tabText, screen.name === "mine" && styles.tabTextActive]}>My needs</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.postButton} onPress={() => setScreen({ name: "create" })}>
        <Text style={styles.postButtonText}>+ Post a money need</Text>
      </TouchableOpacity>

      {screen.name === "feed" ? (
        <NeedsFeedScreen key={`feed-${refreshKey}`} onSelectNeed={handleSelectNeed} />
      ) : (
        <MyNeedsScreen key={`mine-${refreshKey}`} onSelectNeed={handleSelectNeed} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  greeting: { fontSize: 20, fontWeight: "700", color: theme.color.textPrimary },
  role: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2 },
  logout: { color: theme.color.danger, fontSize: 14, fontWeight: "600", paddingTop: 4 },
  tabRow: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginBottom: theme.spacing.sm,
  },
  tab: { paddingBottom: theme.spacing.sm },
  tabText: { fontSize: 14, color: theme.color.textSecondary, fontWeight: "600" },
  tabTextActive: { color: theme.color.primary },
  postButton: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: theme.radius,
    alignItems: "center",
  },
  postButtonText: { color: theme.color.primary, fontSize: 14, fontWeight: "600" },
});
