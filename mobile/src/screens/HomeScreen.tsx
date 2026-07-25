import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";

export function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi{user?.name ? `, ${user.name}` : ""} 👋</Text>
      <Text style={styles.role}>Signed in as {user?.role} · {user?.phone}</Text>
      <Text style={styles.note}>
        The live needs feed lands in Milestone 1. This confirms auth + role loading end-to-end.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  greeting: { fontSize: 24, fontWeight: "700", color: theme.color.textPrimary },
  role: {
    fontSize: 14,
    color: theme.color.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  note: { fontSize: 14, color: theme.color.textSecondary, marginBottom: theme.spacing.xl },
  button: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  buttonText: { color: theme.color.danger, fontSize: 16, fontWeight: "600" },
});
