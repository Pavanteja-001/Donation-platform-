import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchMyNeeds, type MoneyPayload, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton, Badge, type BadgeTone } from "../components/ui";

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

function NeedsListSkeleton() {
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            padding: theme.spacing.lg,
            borderWidth: 1,
            borderColor: theme.color.border,
            borderRadius: theme.radius,
            gap: theme.spacing.sm,
            backgroundColor: theme.color.surface,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton width="50%" height={18} />
            <Skeleton width="20%" height={14} />
          </View>
          <Skeleton width="30%" height={12} />
        </View>
      ))}
    </View>
  );
}

export function MyNeedsScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setError(null);
      try {
        const { needs } = await fetchMyNeeds(token);
        setNeeds(needs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load your needs");
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
          title="You haven't posted any needs yet"
          subtitle="Your posted help requests will be visible here."
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.color.primary} />}
    >
      {needs.map((need) => {
        const money = isMoneyPayload(need.payload) ? need.payload : null;
        return (
          <TouchableOpacity key={need.id} style={styles.card} onPress={() => onSelectNeed(need)} activeOpacity={0.7}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
                <Text style={styles.title} numberOfLines={1}>
                  {need.title}
                </Text>
              </View>
              <Badge label={need.status.replace("_", " ")} tone={STATUS_BADGE_TONE[need.status]} />
            </View>
            {money && (
              <Text style={styles.meta}>
                ₹{money.raised_amount.toLocaleString("en-IN")} / ₹{money.target_amount.toLocaleString("en-IN")}
              </Text>
            )}
            {need.status === "REJECTED" && need.rejectionReason && (
              <Text style={styles.rejection} numberOfLines={2}>
                {need.rejectionReason}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: theme.color.textPrimary },
  meta: { fontSize: 12, color: theme.color.textSecondary, marginTop: 4 },
  rejection: { fontSize: 12, color: theme.color.danger, marginTop: 4 },
});
