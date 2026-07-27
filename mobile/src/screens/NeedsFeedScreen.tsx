import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchNeeds, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { NeedCard } from "../components/NeedCard";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton, Chip } from "../components/ui";

type FilterId = "ALL" | "EMERGENCY" | "BLOOD" | "MONEY" | "KIT" | "MEAL_SLOT" | "GOODS";

// Declarative filter table — each entry owns its own predicate, so adding a filter never means
// touching the render body or a growing switch.
const FILTERS: { id: FilterId; label: string; icon?: keyof typeof Feather.glyphMap; match: (n: Need) => boolean }[] = [
  { id: "ALL", label: "All", match: () => true },
  { id: "EMERGENCY", label: "Emergency", icon: "alert-triangle", match: (n) => n.urgency === "EMERGENCY" },
  { id: "BLOOD", label: "Blood", icon: "droplet", match: (n) => n.type === "BLOOD" },
  { id: "MONEY", label: "Money", icon: "heart", match: (n) => n.type === "MONEY" },
  { id: "KIT", label: "Kits", icon: "package", match: (n) => n.type === "KIT" },
  { id: "MEAL_SLOT", label: "Meals", icon: "coffee", match: (n) => n.type === "MEAL_SLOT" },
  { id: "GOODS", label: "Goods", icon: "box", match: (n) => n.type === "GOODS" },
];

/** Skeleton that mirrors the real card's geometry, so content arriving doesn't shift the layout. */
function FeedSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeletonCard, theme.elevation.level1]}>
          <Skeleton width="100%" height={164} radius={0} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonRow}>
              <Skeleton width={84} height={22} radius={theme.radii.pill} />
              <Skeleton width={64} height={22} radius={theme.radii.pill} />
            </View>
            <Skeleton width="72%" height={20} />
            <Skeleton width="100%" height={13} />
            <Skeleton width="88%" height={13} />
            <Skeleton width="100%" height={8} radius={999} style={{ marginTop: theme.spacing.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

let cachedNeeds: Need[] | null = null;
let cachedNeedsFetchedAt = 0;

export function clearNeedsFeedCache() {
  cachedNeeds = null;
  cachedNeedsFetchedAt = 0;
}

export function NeedsFeedScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(cachedNeeds);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("ALL");

  const load = useCallback(
    async (opts: { silent?: boolean; force?: boolean } = {}) => {
      if (!token) return;

      const now = Date.now();
      const isStale = now - cachedNeedsFetchedAt > 15000;
      if (cachedNeeds !== null && !isStale && !opts.force) {
        return;
      }

      const isSilent = opts.silent || cachedNeeds !== null;
      if (!isSilent) setError(null);
      try {
        const { needs: freshNeeds } = await fetchNeeds(token);
        cachedNeeds = freshNeeds;
        cachedNeedsFetchedAt = Date.now();
        setNeeds(freshNeeds);
      } catch (err) {
        if (!cachedNeeds) {
          setError(err instanceof Error ? err.message : "Failed to load needs");
        }
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Counts come from the unfiltered list so a chip always shows how much it *would* reveal —
  // a zeroed chip is useful information, and hiding it would make the row jump around.
  const counts = useMemo(() => {
    const source = needs ?? [];
    return FILTERS.reduce<Record<FilterId, number>>(
      (acc, f) => {
        acc[f.id] = source.filter(f.match).length;
        return acc;
      },
      {} as Record<FilterId, number>
    );
  }, [needs]);

  const visibleNeeds = useMemo(() => {
    if (!needs) return [];
    const active = FILTERS.find((f) => f.id === filter);
    if (!active || active.id === "ALL") return needs;
    return needs.filter(active.match);
  }, [needs, filter]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load({ silent: true, force: true });
    setIsRefreshing(false);
  }

  const renderItem = useCallback(
    ({ item }: { item: Need }) => <NeedCard need={item} onPress={() => onSelectNeed(item)} />,
    [onSelectNeed]
  );

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!needs) {
    return (
      <View style={styles.screen}>
        <FeedSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Fixed above the list rather than a ListHeaderComponent: filters that scroll away force
          a trip back to the top every time you want to change what you're looking at. */}
      {needs.length > 0 && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                icon={f.icon}
                active={filter === f.id}
                tone={f.id === "EMERGENCY" || f.id === "BLOOD" ? "blood" : "primary"}
                count={f.id === "ALL" ? undefined : counts[f.id]}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {needs.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            title="No live needs right now"
            subtitle="Verified needs will show up here as they go live."
          />
        </View>
      ) : visibleNeeds.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            title={`No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} needs`}
            subtitle="Nothing live in this category yet. Try another filter or pull to refresh."
          />
        </View>
      ) : (
        // Keyed by filter so switching categories fades the new set in instead of hard-cutting.
        <Animated.View key={filter} entering={FadeIn.duration(theme.motion.normal)} style={styles.listWrap}>
          <FlashList
            data={visibleNeeds}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
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
            ListFooterComponent={
              <Text style={styles.footerNote}>
                {visibleNeeds.length} {visibleNeeds.length === 1 ? "need" : "needs"} shown
              </Text>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  listWrap: { flex: 1 },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.borderSubtle,
    backgroundColor: theme.color.background,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  footerNote: {
    ...theme.typography.caption,
    color: theme.color.textTertiary,
    textAlign: "center",
    paddingVertical: theme.spacing.lg,
  },
  skeletonWrap: { padding: theme.spacing.lg, gap: theme.spacing.md },
  skeletonCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xxl,
    overflow: "hidden",
  },
  skeletonBody: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  skeletonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: theme.spacing.xs },
});
