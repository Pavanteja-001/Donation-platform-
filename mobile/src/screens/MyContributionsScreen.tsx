import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchMyContributions, type Contribution, type ContributionKind } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatAmount, formatDate, timeAgo, type IconName } from "../lib/needMeta";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { EmptyState, ErrorState, Skeleton, Badge, Button, Chip, type BadgeTone } from "../components/ui";

const STATUS_BADGE_TONE: Record<Contribution["status"], BadgeTone> = {
  PENDING_CONFIRMATION: "accent",
  CONFIRMED: "success",
  REJECTED: "danger",
};

const STATUS_LABEL: Record<Contribution["status"], string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

// Contribution kinds mirror need types but are their own enum, so they get their own table.
const KIND_META: Record<ContributionKind, { icon: IconName; tint: string; color: string }> = {
  MONEY: { icon: "heart", tint: theme.color.primarySoft, color: theme.color.primary },
  KIT: { icon: "package", tint: theme.color.primarySoft, color: theme.color.primary },
  BLOOD: { icon: "droplet", tint: theme.color.bloodSoft, color: theme.color.blood },
  MEAL_SLOT: { icon: "coffee", tint: theme.color.accentSoft, color: "#8A5A00" },
  GOODS: { icon: "box", tint: theme.color.infoSoft, color: theme.color.info },
  SKILL_REQUEST: { icon: "tool", tint: theme.color.infoSoft, color: theme.color.info },
};

type FilterId = "ALL" | "PENDING" | "CONFIRMED" | "REJECTED";

const FILTERS: { id: FilterId; label: string; match: (c: Contribution) => boolean }[] = [
  { id: "ALL", label: "All", match: () => true },
  { id: "PENDING", label: "Awaiting", match: (c) => c.status === "PENDING_CONFIRMATION" },
  { id: "CONFIRMED", label: "Confirmed", match: (c) => c.status === "CONFIRMED" },
  { id: "REJECTED", label: "Rejected", match: (c) => c.status === "REJECTED" },
];

function summarize(c: Contribution): string {
  if (c.kind === "MONEY") return formatAmount(c.amount ?? 0);
  if (c.kind === "KIT") return `${c.kits} kits`;
  if (c.kind === "BLOOD") return `${c.units} unit${c.units === 1 ? "" : "s"} of blood`;
  if (c.kind === "MEAL_SLOT") {
    const date = c.mealSlotDate ? formatDate(c.mealSlotDate) : "";
    return c.amount != null ? `Meal slot (${formatAmount(c.amount)}) · ${date}` : `Meal slot · ${date}`;
  }
  if (c.kind === "GOODS") return "Claimed item";
  if (c.kind === "SKILL_REQUEST") return "Volunteered time";
  return "Contribution";
}

function ContributionsListSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, theme.elevation.level1, { gap: theme.spacing.md }]}>
          <View style={styles.rowBetween}>
            <Skeleton width={110} height={22} radius={theme.radii.pill} />
            <Skeleton width={72} height={22} radius={theme.radii.pill} />
          </View>
          <Skeleton width="70%" height={18} />
          <Skeleton width="40%" height={13} />
        </View>
      ))}
    </View>
  );
}

function ContributionItem({
  item,
  onViewCertificate,
}: {
  item: Contribution;
  onViewCertificate: (id: string) => void;
}) {
  const meta = KIND_META[item.kind];
  const isConfirmed = item.status === "CONFIRMED";
  const when = timeAgo(item.createdAt);

  return (
    <View style={[styles.card, theme.elevation.level2]}>
      <View style={styles.rowBetween}>
        <View style={styles.kindGroup}>
          <View style={[styles.kindIcon, { backgroundColor: meta.tint }]}>
            <Feather name={meta.icon} size={14} color={meta.color} />
          </View>
          <Text style={styles.summary} numberOfLines={1}>
            {summarize(item)}
          </Text>
        </View>
        <Badge label={STATUS_LABEL[item.status]} tone={STATUS_BADGE_TONE[item.status]} />
      </View>

      <Text style={styles.needTitle} numberOfLines={2}>
        {item.need?.title ?? "Contribution"}
      </Text>

      <View style={styles.metaRow}>
        {when && (
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={theme.color.textTertiary} />
            <Text style={styles.metaText}>{when}</Text>
          </View>
        )}
        {item.utr && (
          <View style={styles.metaItem}>
            <Feather name="hash" size={11} color={theme.color.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.utr}
            </Text>
          </View>
        )}
      </View>

      {/* PRD §14.2 — a platform record, never an official/medical/government document. */}
      {isConfirmed && (
        <Button
          label="View certificate"
          icon="award"
          variant="secondary"
          size="sm"
          compact
          onPress={() => onViewCertificate(item.id)}
        />
      )}
    </View>
  );
}

let cachedContributions: Contribution[] | null = null;
let cachedContributionsFetchedAt = 0;

export function clearContributionsCache() {
  cachedContributions = null;
  cachedContributionsFetchedAt = 0;
}

export function MyContributionsScreen({
  onViewCertificate,
}: {
  onViewCertificate: (contributionId: string) => void;
}) {
  const { token } = useAuth();
  const [contributions, setContributions] = useState<Contribution[] | null>(cachedContributions);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("ALL");

  const load = useCallback(
    async (opts: { silent?: boolean; force?: boolean } = {}) => {
      if (!token) return;

      const now = Date.now();
      const isStale = now - cachedContributionsFetchedAt > 15000;
      if (cachedContributions !== null && !isStale && !opts.force) {
        return;
      }

      const isSilent = opts.silent || cachedContributions !== null;
      if (!isSilent) setError(null);
      try {
        const { contributions: freshContributions } = await fetchMyContributions(token);
        cachedContributions = freshContributions;
        cachedContributionsFetchedAt = Date.now();
        setContributions(freshContributions);
      } catch (err) {
        if (!cachedContributions) {
          setError(err instanceof Error ? err.message : "Failed to load your contributions");
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

  // Impact summary, computed from confirmed contributions only — a pending donation isn't impact
  // yet, and counting it would overstate what the donor has actually done.
  const impact = useMemo(() => {
    const confirmed = (contributions ?? []).filter((c) => c.status === "CONFIRMED");
    return {
      count: confirmed.length,
      amount: confirmed.reduce((sum, c) => sum + (c.amount ?? 0), 0),
      bloodUnits: confirmed.filter((c) => c.kind === "BLOOD").reduce((sum, c) => sum + (c.units ?? 0), 0),
    };
  }, [contributions]);

  const counts = useMemo(() => {
    const source = contributions ?? [];
    return FILTERS.reduce<Record<FilterId, number>>(
      (acc, f) => {
        acc[f.id] = source.filter(f.match).length;
        return acc;
      },
      {} as Record<FilterId, number>
    );
  }, [contributions]);

  const visible = useMemo(() => {
    if (!contributions) return [];
    const active = FILTERS.find((f) => f.id === filter);
    if (!active || active.id === "ALL") return contributions;
    return contributions.filter(active.match);
  }, [contributions, filter]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load({ silent: true, force: true });
    setIsRefreshing(false);
  }

  const renderItem = useCallback(
    ({ item }: { item: Contribution }) => <ContributionItem item={item} onViewCertificate={onViewCertificate} />,
    [onViewCertificate]
  );

  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!contributions) {
    return (
      <View style={styles.screen}>
        <ContributionsListSkeleton />
      </View>
    );
  }

  if (contributions.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="heart"
          title="No contributions yet"
          subtitle="Once you donate or pledge, your history and certificates will appear here."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeInDown.duration(360)} style={[styles.impactCard, theme.elevation.level2]}>
        <View style={styles.impactStat}>
          <AnimatedCounter value={impact.count} style={styles.impactValue} />
          <Text style={styles.impactLabel}>Confirmed</Text>
        </View>
        <View style={styles.impactDivider} />
        <View style={styles.impactStat}>
          <AnimatedCounter value={impact.amount} prefix="₹" style={styles.impactValue} />
          <Text style={styles.impactLabel}>Donated</Text>
        </View>
        {impact.bloodUnits > 0 && (
          <>
            <View style={styles.impactDivider} />
            <View style={styles.impactStat}>
              <AnimatedCounter value={impact.bloodUnits} style={[styles.impactValue, { color: theme.color.blood }]} />
              <Text style={styles.impactLabel}>Blood units</Text>
            </View>
          </>
        )}
      </Animated.View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              active={filter === f.id}
              count={f.id === "ALL" ? undefined : counts[f.id]}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="filter"
            title={`Nothing ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}`}
            subtitle="Try another filter to see the rest of your contributions."
          />
        </View>
      ) : (
        <Animated.View key={filter} entering={FadeIn.duration(theme.motion.normal)} style={styles.listWrap}>
          <FlashList
            data={visible}
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

  impactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    margin: theme.spacing.lg,
    marginBottom: 0,
  },
  impactStat: { flex: 1, alignItems: "center", gap: 2 },
  impactValue: { ...theme.typography.h2, color: theme.color.textPrimary },
  impactLabel: { ...theme.typography.caption, color: theme.color.textTertiary },
  impactDivider: { width: 1, alignSelf: "stretch", backgroundColor: theme.color.borderSubtle },

  filterBar: { borderBottomWidth: 1, borderBottomColor: theme.color.borderSubtle },
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

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  kindGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  kindIcon: { width: 26, height: 26, borderRadius: theme.radii.xs, alignItems: "center", justifyContent: "center" },
  summary: { ...theme.typography.bodyMedium, fontWeight: "800", color: theme.color.textPrimary, flexShrink: 1 },
  needTitle: { ...theme.typography.bodySmall, color: theme.color.textSecondary },

  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.lg, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  metaText: { ...theme.typography.caption, color: theme.color.textTertiary, flexShrink: 1 },
});
