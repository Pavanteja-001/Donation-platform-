import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { fetchNeeds, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { categoryById, type NeedCategory } from "../lib/needCategory";
import { NeedCard } from "../components/NeedCard";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";

/**
 * Every live need filed under one cause.
 *
 * Deliberately a plain list rather than a second home screen: someone who tapped "Education" has
 * already told us what they want, so re-showing filter chips, stats and an emergency rail would
 * put the thing they asked for below the fold of a screen they navigated to on purpose.
 */
export function CategoryNeedsScreen({
  category,
  onSelectNeed,
}: {
  category: NeedCategory;
  onSelectNeed: (need: Need) => void;
}) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const meta = categoryById(category);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const { needs: data } = await fetchNeeds(token, { category });
      setNeeds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this category");
    }
  }, [token, category]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlashList
        data={needs ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        masonry
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <NeedCard need={item} compact onPress={() => onSelectNeed(item)} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.color.primary}
            colors={[theme.color.primary]}
          />
        }
        ListHeaderComponent={
          meta ? (
            <View style={styles.header}>
              <Text style={styles.hint}>{meta.hint}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          needs === null ? (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="48%" height={210} radius={theme.radii.xxl} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <EmptyState
                icon="inbox"
                title={`No live ${meta?.label.toLowerCase() ?? "needs"} requests`}
                // Says why rather than just that it's empty — an empty category on a new platform
                // means nobody has asked yet, not that something is broken.
                subtitle="Nothing has been posted here yet. Pull to refresh, or check back soon."
              />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  listContent: { paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.xxl },
  // Half the gutter per cell; the matching padding on the list brings the screen edges to match.
  cardWrap: { paddingHorizontal: theme.spacing.sm, flex: 1 },
  header: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
  hint: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  empty: { paddingTop: theme.spacing.xxl },
  skeletonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
});
