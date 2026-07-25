import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fetchMyNeeds, type MoneyPayload, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

const STATUS_COLOR: Record<Need["status"], string> = {
  DRAFT: theme.color.textSecondary,
  PENDING_VERIFICATION: theme.color.accent,
  LIVE: theme.color.primary,
  PARTIALLY_FULFILLED: theme.color.primary,
  FULFILLED: theme.color.primary,
  REJECTED: theme.color.danger,
  EXPIRED: theme.color.danger,
  CANCELLED: theme.color.danger,
};

// PRD §6.2 — lets a poster track their own need through verification/funding without needing
// to know its id (a gap the public feed alone can't fill, since it only shows LIVE+ needs).
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

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load({ silent: true });
    setIsRefreshing(false);
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!needs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }
  if (needs.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>You haven't posted anything yet</Text>
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
              <Text style={styles.title} numberOfLines={1}>
                {need.title}
              </Text>
              <Text style={[styles.status, { color: STATUS_COLOR[need.status] }]}>{need.status.replace("_", " ")}</Text>
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
  errorText: { color: theme.color.danger, textAlign: "center" },
  emptyTitle: { fontSize: 15, color: theme.color.textSecondary, textAlign: "center" },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.color.textPrimary, marginRight: theme.spacing.sm },
  status: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  meta: { fontSize: 12, color: theme.color.textSecondary, marginTop: 4 },
  rejection: { fontSize: 12, color: theme.color.danger, marginTop: 4 },
});
