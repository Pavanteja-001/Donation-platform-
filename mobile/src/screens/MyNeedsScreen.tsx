import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchMyNeeds, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import {
  STATUS_BADGE_TONE,
  STATUS_LABEL,
  TYPE_META,
  isBloodPayload,
  isKitPayload,
  isMealSlotPayload,
  isMoneyPayload,
  formatAmount,
  timeAgo,
} from "../lib/needMeta";
import { ProgressBar } from "../components/ProgressBar";
import { EmptyState, ErrorState, Skeleton, Badge, Chip, PressableScale } from "../components/ui";

type FilterId = "ALL" | "REVIEW" | "LIVE" | "DONE" | "ATTENTION";

// A poster cares about *what they must do next*, not about the raw lifecycle enum — so the
// filters are grouped by action ("needs attention") rather than mapped 1:1 to statuses.
const FILTERS: { id: FilterId; label: string; match: (n: Need) => boolean }[] = [
  { id: "ALL", label: "All", match: () => true },
  { id: "REVIEW", label: "In review", match: (n) => n.status === "PENDING_VERIFICATION" || n.status === "DRAFT" },
  { id: "LIVE", label: "Live", match: (n) => n.status === "LIVE" || n.status === "PARTIALLY_FULFILLED" },
  { id: "DONE", label: "Completed", match: (n) => n.status === "FULFILLED" },
  {
    id: "ATTENTION",
    label: "Needs attention",
    match: (n) => n.status === "REJECTED" || n.status === "EXPIRED" || n.status === "CANCELLED",
  },
];

function NeedsListSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, theme.elevation.level1, { gap: theme.spacing.md }]}>
          <View style={styles.rowBetween}>
            <Skeleton width={96} height={22} radius={theme.radii.pill} />
            <Skeleton width={64} height={22} radius={theme.radii.pill} />
          </View>
          <Skeleton width="75%" height={18} />
          <Skeleton width="100%" height={8} radius={999} />
        </View>
      ))}
    </View>
  );
}

function NeedItem({ item, onSelect }: { item: Need; onSelect: (need: Need) => void }) {
  const meta = TYPE_META[item.type];
  const money = isMoneyPayload(item.payload) ? item.payload : null;
  const kit = isKitPayload(item.payload) ? item.payload : null;
  const blood = isBloodPayload(item.payload) ? item.payload : null;
  const mealSlot = isMealSlotPayload(item.payload) ? item.payload : null;
  const posted = timeAgo(item.createdAt);
  const isRejected = item.status === "REJECTED";

  return (
    <PressableScale
      onPress={() => onSelect(item)}
      scaleTo={0.985}
      accessibilityLabel={item.title}
      style={[styles.card, theme.elevation.level2, isRejected && styles.cardRejected]}
    >
      <View style={styles.rowBetween}>
        <View style={styles.typeGroup}>
          <View style={[styles.typeIcon, { backgroundColor: meta.tint }]}>
            <Feather name={meta.icon} size={13} color={meta.color} />
          </View>
          <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Badge label={STATUS_LABEL[item.status]} tone={STATUS_BADGE_TONE[item.status]} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {money && (
        <View style={styles.progressBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.raised}>{formatAmount(money.raised_amount)}</Text>
            <Text style={styles.target}>of {formatAmount(money.target_amount)}</Text>
          </View>
          <ProgressBar raised={money.raised_amount} target={money.target_amount} showLabel={false} />
        </View>
      )}

      {blood && (
        <View style={styles.progressBlock}>
          <ProgressBar
            raised={blood.units_fulfilled}
            target={blood.units_needed}
            tone="blood"
            label={`${blood.units_fulfilled} of ${blood.units_needed} units`}
          />
        </View>
      )}

      {kit && (
        <View style={styles.progressBlock}>
          <ProgressBar
            raised={kit.kits_funded}
            target={kit.kits_needed}
            label={`${kit.kits_funded} of ${kit.kits_needed} kits funded`}
          />
        </View>
      )}

      {mealSlot && (
        <View style={styles.progressBlock}>
          <ProgressBar
            raised={mealSlot.slots_confirmed}
            target={mealSlot.slots_total}
            tone="accent"
            label={`${mealSlot.slots_confirmed} of ${mealSlot.slots_total} slots confirmed`}
          />
        </View>
      )}

      {/* D-017 — the rejection reason is mandatory and must be visible to the poster. */}
      {isRejected && item.rejectionReason && (
        <View style={styles.rejectionBox}>
          <Feather name="x-circle" size={14} color={theme.color.danger} />
          <Text style={styles.rejectionText} numberOfLines={3}>
            {item.rejectionReason}
          </Text>
        </View>
      )}

      {posted && (
        <View style={styles.footer}>
          <Feather name="clock" size={11} color={theme.color.textTertiary} />
          <Text style={styles.footerText}>Posted {posted}</Text>
        </View>
      )}
    </PressableScale>
  );
}

let cachedMyNeeds: Need[] | null = null;
let cachedMyNeedsFetchedAt = 0;

export function clearMyNeedsCache() {
  cachedMyNeeds = null;
  cachedMyNeedsFetchedAt = 0;
}

export function MyNeedsScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(cachedMyNeeds);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("ALL");

  const load = useCallback(
    async (opts: { silent?: boolean; force?: boolean } = {}) => {
      if (!token) return;

      const now = Date.now();
      const isStale = now - cachedMyNeedsFetchedAt > 15000;
      if (cachedMyNeeds !== null && !isStale && !opts.force) {
        return;
      }

      const isSilent = opts.silent || cachedMyNeeds !== null;
      if (!isSilent) setError(null);
      try {
        const { needs: freshNeeds } = await fetchMyNeeds(token);
        cachedMyNeeds = freshNeeds;
        cachedMyNeedsFetchedAt = Date.now();
        setNeeds(freshNeeds);
      } catch (err) {
        if (!cachedMyNeeds) {
          setError(err instanceof Error ? err.message : "Failed to load your needs");
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
    ({ item }: { item: Need }) => <NeedItem item={item} onSelect={onSelectNeed} />,
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
        <NeedsListSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {needs.length > 0 && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                active={filter === f.id}
                tone={f.id === "ATTENTION" ? "blood" : "primary"}
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
            icon="file-plus"
            title="You haven't posted anything yet"
            subtitle="Needs you post will show up here so you can track them through verification and funding."
          />
        </View>
      ) : visibleNeeds.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="filter"
            title={`Nothing ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}`}
            subtitle="Try another filter to see the rest of your needs."
          />
        </View>
      ) : (
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

  filterBar: { borderBottomWidth: 1, borderBottomColor: theme.color.borderSubtle, backgroundColor: theme.color.background },
  filterRow: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, gap: theme.spacing.sm },

  skeletonWrap: { padding: theme.spacing.lg, gap: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardRejected: { borderColor: "rgba(220, 38, 38, 0.18)" },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  typeGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  typeIcon: { width: 24, height: 24, borderRadius: theme.radii.xs, alignItems: "center", justifyContent: "center" },
  typeLabel: { ...theme.typography.overline, textTransform: "uppercase" },

  title: { ...theme.typography.h3, color: theme.color.textPrimary },
  progressBlock: { marginTop: theme.spacing.xs, gap: theme.spacing.sm },
  raised: { ...theme.typography.h2, color: theme.color.textPrimary },
  target: { ...theme.typography.caption, color: theme.color.textSecondary },

  rejectionBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.dangerSoft,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  rejectionText: { ...theme.typography.caption, color: theme.color.dangerDeep, fontWeight: "600", flex: 1, lineHeight: 17 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  footerText: { ...theme.typography.caption, color: theme.color.textTertiary },
});
