import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { fetchNeeds, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { NeedCard } from "../components/NeedCard";
import { theme } from "../lib/theme";

// CLAUDE.md performance rules: FlashList for feeds, skeleton/empty/error states — never default.
export function NeedsFeedScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setError(null);
      try {
        const { needs } = await fetchNeeds(token);
        setNeeds(needs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load needs");
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load({ silent: true });
    setIsRefreshing(false);
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!needs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }

  if (needs.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No live needs right now</Text>
        <Text style={styles.emptySubtitle}>Verified needs will show up here as they go live.</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={needs}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NeedCard need={item} onPress={() => onSelectNeed(item)} />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.color.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: theme.spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  errorText: { color: theme.color.danger, textAlign: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: theme.color.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.color.textSecondary, textAlign: "center" },
});
