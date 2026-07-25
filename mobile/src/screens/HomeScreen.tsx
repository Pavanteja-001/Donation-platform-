import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { NeedsFeedScreen } from "./NeedsFeedScreen";

export function HomeScreen() {
  const { user, signOut } = useAuth();

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
      <NeedsFeedScreen />
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
});
