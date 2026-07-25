import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { fetchNeeds, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { NeedCard } from "../components/NeedCard";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";

function FeedSkeleton() {
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            padding: theme.spacing.md,
            borderWidth: 1,
            borderColor: theme.color.border,
            borderRadius: theme.radius,
            gap: theme.spacing.sm,
            backgroundColor: theme.color.surface,
          }}
        >
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="100%" height={8} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load({ silent: true });
    setIsRefreshing(false);
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!needs) {
    return <FeedSkeleton />;
  }

  if (needs.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="No live needs right now"
          subtitle="Verified needs will show up here as they go live."
        />
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
});
