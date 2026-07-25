import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import type { Need } from "../lib/api";
import { registerForPushNotificationsAsync } from "../lib/pushNotifications";
import { NeedsFeedScreen } from "./NeedsFeedScreen";
import { MyNeedsScreen } from "./MyNeedsScreen";
import { NeedDetailScreen } from "./NeedDetailScreen";
import { CreateMoneyNeedScreen } from "./CreateMoneyNeedScreen";
import { CreateKitNeedScreen } from "./CreateKitNeedScreen";
import { CreateBloodNeedScreen } from "./CreateBloodNeedScreen";
import { BloodProfileScreen } from "./BloodProfileScreen";

// No routing library yet (kept minimal for Milestones 0-4) — a simple local view switch is
// enough for feed / my-needs / detail / create / blood-profile. Revisit once the app has enough
// screens to need real nav.
type Screen =
  | { name: "feed" }
  | { name: "mine" }
  | { name: "detail"; needId: string }
  | { name: "create-money" }
  | { name: "create-kit" }
  | { name: "create-blood" }
  | { name: "blood-profile" };

export function HomeScreen() {
  const { user, token, signOut } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: "feed" });
  const [refreshKey, setRefreshKey] = useState(0);

  // D-016 — register this device for push once per login session (best-effort; see
  // lib/pushNotifications.ts for why it can silently no-op in this dev setup).
  useEffect(() => {
    if (token) registerForPushNotificationsAsync(token);
  }, [token]);

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
  if (screen.name === "create-money") {
    return <CreateMoneyNeedScreen onBack={() => setScreen({ name: "feed" })} onDone={backToMine} />;
  }
  if (screen.name === "create-kit") {
    return <CreateKitNeedScreen onBack={() => setScreen({ name: "feed" })} onDone={backToMine} />;
  }
  if (screen.name === "create-blood") {
    return <CreateBloodNeedScreen onBack={() => setScreen({ name: "feed" })} onDone={backToMine} />;
  }
  if (screen.name === "blood-profile") {
    return <BloodProfileScreen onBack={() => setScreen({ name: "feed" })} />;
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setScreen({ name: "blood-profile" })}>
            <Text style={styles.bloodProfileLink}>Blood profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={styles.tab} onPress={() => setScreen({ name: "feed" })}>
          <Text style={[styles.tabText, screen.name === "feed" && styles.tabTextActive]}>Live needs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setScreen({ name: "mine" })}>
          <Text style={[styles.tabText, screen.name === "mine" && styles.tabTextActive]}>My needs</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.postRow}>
        <TouchableOpacity style={styles.postButton} onPress={() => setScreen({ name: "create-money" })}>
          <Text style={styles.postButtonText}>+ Money</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postButton} onPress={() => setScreen({ name: "create-kit" })}>
          <Text style={styles.postButtonText}>+ Kit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postButton} onPress={() => setScreen({ name: "create-blood" })}>
          <Text style={styles.postButtonText}>+ Blood</Text>
        </TouchableOpacity>
      </View>

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
  headerActions: { alignItems: "flex-end", gap: 4 },
  bloodProfileLink: { color: theme.color.primary, fontSize: 13, fontWeight: "600" },
  logout: { color: theme.color.danger, fontSize: 14, fontWeight: "600" },
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
  postRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  postButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.primary,
    borderRadius: theme.radius,
    alignItems: "center",
  },
  postButtonText: { color: theme.color.primary, fontSize: 14, fontWeight: "600" },
});
