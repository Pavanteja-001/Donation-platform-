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

type FilterId = "ALL" | "URGENT" | "BLOOD" | "MONEY" | "KIT" | "MEAL_SLOT";

// Declarative filter table — each entry owns its own predicate, so adding a filter never means
// touching the render body or a growing switch.
const FILTERS: { id: FilterId; label: string; icon?: keyof typeof Feather.glyphMap; match: (n: Need) => boolean }[] = [
  { id: "ALL", label: "All", match: () => true },
  // Urgent, not Emergency. Emergencies are pinned in the rail above and excluded from this list
  // entirely (see `feedNeeds`), so a chip filtering for them would always come back empty —
  // Urgent is the next tier down and the one this row can actually reveal.
  { id: "URGENT", label: "Urgent", icon: "alert-triangle", match: (n) => n.urgency === "URGENT" },
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
    // No top padding: this renders directly under the filter chip row, which already ends with
    // its own vertical padding. Both were being applied, leaving a gap twice the intended size.
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

  /**
   * What the list below the chips is allowed to show.
   *
   * Emergencies are deliberately absent: they're pinned in the rail directly above, and having
   * them in both places meant the same card appeared twice on one screen — once as a tile, then
   * again as a full-width card a few hundred pixels lower. The rail is unfiltered, so nothing is
   * hidden by this; an emergency is always visible, just in one place instead of two.
   */
  const feedNeeds = useMemo(() => (needs ?? []).filter((n) => n.urgency !== "EMERGENCY"), [needs]);

  // Counts come from that same source, so a chip never promises more than tapping it delivers.
  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<FilterId, number>>(
        (acc, f) => {
          acc[f.id] = feedNeeds.filter(f.match).length;
          return acc;
        },
        {} as Record<FilterId, number>
      ),
    [feedNeeds]
  );

  const visibleNeeds = useMemo(() => {
    if (!needs) return [];
    const active = FILTERS.find((f) => f.id === filter);
    if (!active || active.id === "ALL") return feedNeeds;
    return feedNeeds.filter(active.match);
  }, [needs, feedNeeds, filter]);

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

  // Memoised: handing FlashList a freshly-created element every render is what let the header's
  // children re-run their mount work (and, before they were removed, replay their entrances).
  const listHeader = useMemo(
    () => (
      <FeedListHeader
        needs={needs ?? []}
        counts={counts}
        filter={filter}
        onFilterChange={setFilter}
        onSelectNeed={onSelectNeed}
        isLoading={needs === null}
      />
    ),
    [needs, counts, filter, onSelectNeed]
  );

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  const isLoading = needs === null;

  return (
    <View style={styles.screen}>
      <View style={styles.listWrap}>
        {/* One tree for every state — loading, empty and populated.
         *
         * These used to be three separate returns. Even with identical furniture in each, React
         * unmounted one tree and mounted another when the fetch landed, so the whole header was
         * destroyed and rebuilt: the shimmer visibly broke and the hero and rail snapped back into
         * place. Keeping the same FlashList mounted throughout means only the list body changes —
         * skeletons give way to cards, and nothing above them moves. */}
        <FlashList
          data={visibleNeeds}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Hero + explore row + emergency rail + filters travel with the list. They used to be
          // pinned above it, but a hero that never scrolls away would permanently eat a third of
          // the screen — and the chips read as belonging to the header they sit under.
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.color.primary}
              colors={[theme.color.primary]}
            />
          }
          // Every "nothing to show" case stays inside the list, so the hero and the chips remain
          // on screen — rendering any of them as a separate branch hid the chips and left no way
          // back.
          ListEmptyComponent={
            isLoading ? (
              <FeedSkeleton />
            ) : feedNeeds.length === 0 ? (
              <View style={styles.filterEmpty}>
                <EmptyState
                  icon="inbox"
                  title={needs!.length === 0 ? "No live needs right now" : "Nothing else right now"}
                  subtitle={
                    needs!.length === 0
                      ? "Verified needs will show up here as they go live."
                      : "The emergencies above are the only live needs at the moment."
                  }
                />
              </View>
            ) : (
              <View style={styles.filterEmpty}>
                <EmptyState
                  icon="filter"
                  title={`No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} needs`}
                  subtitle="Nothing live in this category yet. Try another filter or pull to refresh."
                />
              </View>
            )
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
  isLoading,
}: {
  isLoading: boolean;
  needs: Need[];
  counts: Record<FilterId, number>;
  filter: FilterId;
  onFilterChange: (id: FilterId) => void;
  onSelectNeed: (need: Need) => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <FeedHero needs={needs} />
      {/* Explore sits above the emergency rail on purpose: it's fixed furniture, so it belongs
          directly under the hero where it's always in the same place. The emergency rail comes
          and goes with the data, and a section that appears above a fixed row shoves that row
          down the page every time an emergency opens. */}
      <ExploreOrganisations />
      <EmergencySpotlight needs={needs} onSelectNeed={onSelectNeed} isLoading={isLoading} />

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
            tone={f.id === "URGENT" || f.id === "BLOOD" ? "blood" : "primary"}
            // No count while the feed is still fetching. A count of 0 is a claim, not a
            // placeholder — and a wrong one that flips to a real number a moment later.
            count={f.id === "ALL" || isLoading ? undefined : counts[f.id]}
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
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  footerNote: {
    ...theme.typography.caption,
    color: theme.color.textTertiary,
    textAlign: "center",
    paddingVertical: theme.spacing.lg,
  },
  skeletonWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
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
