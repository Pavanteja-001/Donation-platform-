import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchNeeds, type Need } from "../lib/api";
import { needsFeedCache, isStale } from "../lib/listCache";
import { useAuth } from "../context/AuthContext";
import { NeedCard } from "../components/NeedCard";
import { FeedHero } from "../components/FeedHero";
import { ExploreOrganisations } from "../components/ExploreOrganisations";
import { EmergencySpotlight } from "../components/EmergencySpotlight";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton, Chip } from "../components/ui";

type FilterId = "ALL" | "EMERGENCY" | "BLOOD" | "MONEY" | "KIT" | "MEAL_SLOT";

// Declarative filter table — each entry owns its own predicate, so adding a filter never means
// touching the render body or a growing switch.
const FILTERS: { id: FilterId; label: string; icon?: keyof typeof Feather.glyphMap; match: (n: Need) => boolean }[] = [
  { id: "ALL", label: "All", match: () => true },
  { id: "EMERGENCY", label: "Emergency", icon: "alert-triangle", match: (n) => n.urgency === "EMERGENCY" },
  { id: "BLOOD", label: "Blood", icon: "droplet", match: (n) => n.type === "BLOOD" },
  { id: "MONEY", label: "Money", icon: "heart", match: (n) => n.type === "MONEY" },
  { id: "KIT", label: "Kits", icon: "package", match: (n) => n.type === "KIT" },
  { id: "MEAL_SLOT", label: "Meals", icon: "coffee", match: (n) => n.type === "MEAL_SLOT" },
  // No GOODS chip: item listings live on the Goods screen and the server keeps them out of this
  // feed entirely, so a chip here would only ever show an empty result.
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

export function NeedsFeedScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(needsFeedCache.data);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("ALL");

  const load = useCallback(
    async (opts: { silent?: boolean; force?: boolean } = {}) => {
      if (!token) return;

      if (needsFeedCache.data !== null && !isStale(needsFeedCache) && !opts.force) {
        return;
      }

      const isSilent = opts.silent || needsFeedCache.data !== null;
      if (!isSilent) setError(null);
      try {
        const { needs: freshNeeds } = await fetchNeeds(token);
        needsFeedCache.data = freshNeeds;
        needsFeedCache.fetchedAt = Date.now();
        setNeeds(freshNeeds);
      } catch (err) {
        if (!needsFeedCache.data) {
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

  // Cards cascade in the first time they're seen, but never again. FlashList recycles rows, so an
  // unconditional entering animation would replay the cascade every time you scrolled back up —
  // the exact jank the animation is supposed to hide.
  const seenIds = useRef(new Set<string>());

  const renderItem = useCallback(
    ({ item, index }: { item: Need; index: number }) => {
      const isFirstSight = !seenIds.current.has(item.id);
      seenIds.current.add(item.id);

      const card = (
        <View style={styles.cardWrap}>
          <NeedCard need={item} onPress={() => onSelectNeed(item)} />
        </View>
      );
      if (!isFirstSight) return card;

      return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 55).duration(360)}>
          {card}
        </Animated.View>
      );
    },
    [onSelectNeed]
  );

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  // The hero renders during loading too, with zeroed counters — so the header doesn't pop into
  // existence and shove the first card down once the fetch lands.
  if (!needs) {
    return (
      <View style={styles.screen}>
        <FeedHero needs={[]} />
        <FeedSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {needs.length === 0 ? (
        <>
          <FeedHero needs={[]} />
          {/* Deliberately kept in the empty branch too. This is the one screen state where a donor
              has nothing to act on, so the organisation directories are the most useful thing on
              it — hiding them here would strand anyone who opens the app on a quiet day. */}
          <ExploreOrganisations />
          <View style={styles.centered}>
            <EmptyState
              icon="inbox"
              title="No live needs right now"
              subtitle="Verified needs will show up here as they go live."
            />
          </View>
        </>
      ) : (
        <View style={styles.listWrap}>
          <FlashList
            data={visibleNeeds}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            // Hero + emergency rail + filters travel with the list. They used to be pinned above
            // it, but a hero that never scrolls away would permanently eat a third of the screen —
            // and the chips read as belonging to the header they sit under.
            ListHeaderComponent={
              <FeedListHeader
                needs={needs}
                counts={counts}
                filter={filter}
                onFilterChange={setFilter}
                onSelectNeed={onSelectNeed}
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.color.primary}
                colors={[theme.color.primary]}
              />
            }
            // An empty *filter* result stays inside the list, so the hero and the chips remain on
            // screen — rendering it as a separate branch hid the chips and left no way back.
            ListEmptyComponent={
              <View style={styles.filterEmpty}>
                <EmptyState
                  icon="filter"
                  title={`No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} needs`}
                  subtitle="Nothing live in this category yet. Try another filter or pull to refresh."
                />
              </View>
            }
            ListFooterComponent={
              visibleNeeds.length === 0 ? null : (
                <Text style={styles.footerNote}>
                  {visibleNeeds.length} {visibleNeeds.length === 1 ? "need" : "needs"} shown
                </Text>
              )
            }
          />
        </View>
      )}
    </View>
  );
}

/**
 * Everything above the cards: crimson hero, pinned emergency rail, then the filter row.
 *
 * Split out so FlashList can treat it as one header block, and so the filter state stays owned by
 * the screen rather than leaking into the hero.
 */
function FeedListHeader({
  needs,
  counts,
  filter,
  onFilterChange,
  onSelectNeed,
}: {
  needs: Need[];
  counts: Record<FilterId, number>;
  filter: FilterId;
  onFilterChange: (id: FilterId) => void;
  onSelectNeed: (need: Need) => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <FeedHero needs={needs} />
      <EmergencySpotlight needs={needs} onSelectNeed={onSelectNeed} />
      <ExploreOrganisations />

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
            onPress={() => onFilterChange(f.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  listWrap: { flex: 1 },
  // No horizontal padding here — the hero is full-bleed. Cards get their inset from `cardWrap`.
  listContent: { paddingBottom: theme.spacing.xxl },
  cardWrap: { paddingHorizontal: theme.spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  headerBlock: { marginBottom: theme.spacing.xs },
  filterEmpty: { paddingTop: theme.spacing.xxl },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
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
