import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, Pressable, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { fetchMyNeeds, type MoneyPayload, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton, Badge, Card, type BadgeTone } from "../components/ui";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

const STATUS_BADGE_TONE: Record<Need["status"], BadgeTone> = {
  DRAFT: "neutral",
  PENDING_VERIFICATION: "accent",
  LIVE: "primary",
  PARTIALLY_FULFILLED: "primary",
  FULFILLED: "primary",
  REJECTED: "danger",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function NeedsListSkeleton() {
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {[1, 2, 3].map((i) => (
        <Card elevated key={i} style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton width="50%" height={18} />
            <Skeleton width="20%" height={14} />
          </View>
          <Skeleton width="30%" height={12} />
        </Card>
      ))}
    </View>
  );
}

function NeedItem({ item, onSelect }: { item: Need; onSelect: (need: Need) => void }) {
  const scale = useSharedValue(1);
  const money = isMoneyPayload(item.payload) ? item.payload : null;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <AnimatedPressable
      onPress={() => onSelect(item)}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 15 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
      style={[styles.card, theme.elevation.level1, animatedStyle]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Badge label={item.status.replace("_", " ")} tone={STATUS_BADGE_TONE[item.status]} />
      </View>
      {money && (
        <Text style={styles.meta}>
          ₹{money.raised_amount.toLocaleString("en-IN")} / ₹{money.target_amount.toLocaleString("en-IN")}
        </Text>
      )}
      {item.status === "REJECTED" && item.rejectionReason && (
        <Text style={styles.rejection} numberOfLines={2}>
          {item.rejectionReason}
        </Text>
      )}
    </AnimatedPressable>
  );
}

let cachedMyNeeds: Need[] | null = null;

export function clearMyNeedsCache() {
  cachedMyNeeds = null;
}

export function MyNeedsScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(cachedMyNeeds);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      const isSilent = opts.silent || cachedMyNeeds !== null;
      if (!isSilent) setError(null);
      try {
        const { needs: freshNeeds } = await fetchMyNeeds(token);
        cachedMyNeeds = freshNeeds;
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
    return <NeedsListSkeleton />;
  }

  if (needs.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="No helper requests yet"
          subtitle="Your posted helper requests will be visible here."
        />
      </View>
    );
  }

  return (
    <FlashList
      data={needs}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NeedItem item={item} onSelect={onSelectNeed} />}
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
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius * 1.2,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: theme.color.textPrimary },
  meta: { fontSize: 12, color: theme.color.textSecondary, marginTop: 4, fontWeight: "500" },
  rejection: { fontSize: 12, color: theme.color.danger, marginTop: 4, fontWeight: "500" },
});
