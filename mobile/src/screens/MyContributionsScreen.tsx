import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, Pressable, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { fetchMyContributions, type Contribution } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton, Badge, Card, type BadgeTone } from "../components/ui";

const STATUS_BADGE_TONE: Record<Contribution["status"], BadgeTone> = {
  PENDING_CONFIRMATION: "accent",
  CONFIRMED: "primary",
  REJECTED: "danger",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function summarize(c: Contribution): string {
  if (c.kind === "MONEY") return `₹${c.amount?.toLocaleString("en-IN")}`;
  if (c.kind === "KIT") return `${c.kits} kits`;
  if (c.kind === "BLOOD") return `${c.units} unit${c.units === 1 ? "" : "s"} of blood`;
  if (c.kind === "MEAL_SLOT") {
    const date = c.mealSlotDate ? formatDate(c.mealSlotDate) : "";
    return c.amount != null ? `Meal slot (₹${c.amount.toLocaleString("en-IN")}) · ${date}` : `Meal slot · ${date}`;
  }
  return "Claimed item";
}

function ContributionsListSkeleton() {
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {[1, 2, 3].map((i) => (
        <Card elevated key={i} style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton width="50%" height={18} />
            <Skeleton width="20%" height={14} />
          </View>
          <Skeleton width="40%" height={12} />
          <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
        </Card>
      ))}
    </View>
  );
}

function ContributionItem({ item, onViewCertificate }: { item: Contribution; onViewCertificate: (id: string) => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Card elevated style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
          <Text style={styles.title} numberOfLines={1}>
            {item.need?.title ?? "—"}
          </Text>
        </View>
        <Badge label={item.status.replace("_", " ")} tone={STATUS_BADGE_TONE[item.status]} />
      </View>
      <Text style={styles.meta}>{summarize(item)}</Text>
      <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      {item.status === "CONFIRMED" && (
        <AnimatedPressable
          onPress={() => onViewCertificate(item.id)}
          onPressIn={() => (scale.value = withSpring(0.95, { damping: 15 }))}
          onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
          style={[styles.linkContainer, animatedStyle]}
        >
          <Text style={styles.link}>View Certificate</Text>
        </AnimatedPressable>
      )}
    </Card>
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

  async function handleRefresh() {
    setIsRefreshing(true);
    await load({ silent: true, force: true });
    setIsRefreshing(false);
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!contributions) {
    return <ContributionsListSkeleton />;
  }

  if (contributions.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="No contributions yet"
          subtitle="Your contributions history will appear here once you make a donation or pledge."
        />
      </View>
    );
  }

  return (
    <FlashList
      data={contributions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ContributionItem item={item} onViewCertificate={onViewCertificate} />
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.color.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  card: {
    marginBottom: theme.spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: theme.color.textPrimary },
  meta: { fontSize: 13, color: theme.color.textPrimary, marginTop: 4, fontWeight: "500" },
  date: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2, fontWeight: "500" },
  linkContainer: { alignSelf: "flex-start", marginTop: theme.spacing.sm },
  link: { color: theme.color.primary, fontSize: 13, fontWeight: "700" },
});
