import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fetchMyContributions, type Contribution } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";

const STATUS_COLOR: Record<Contribution["status"], string> = {
  PENDING_CONFIRMATION: theme.color.accent,
  CONFIRMED: theme.color.primary,
  REJECTED: theme.color.danger,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Kind-aware — mirrors the formatContributionAmount() already built for NeedDetailScreen, but
// this list has no Need payload to lean on, only the Contribution's own fields.
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

// PRD §14.3 — the first place a donor sees their own contribution history, not just what a
// beneficiary sees of it. Confirmed ones link to a certificate (§14.2).
export function MyContributionsScreen({
  onViewCertificate,
}: {
  onViewCertificate: (contributionId: string) => void;
}) {
  const { token } = useAuth();
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setError(null);
      try {
        const { contributions } = await fetchMyContributions(token);
        setContributions(contributions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load your contributions");
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
  if (!contributions) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }
  if (contributions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>You haven't contributed to anything yet</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.color.primary} />}
    >
      {contributions.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {c.need?.title ?? "—"}
            </Text>
            <Text style={[styles.status, { color: STATUS_COLOR[c.status] }]}>{c.status.replace("_", " ")}</Text>
          </View>
          <Text style={styles.meta}>{summarize(c)}</Text>
          <Text style={styles.date}>{formatDate(c.createdAt)}</Text>
          {c.status === "CONFIRMED" && (
            <TouchableOpacity onPress={() => onViewCertificate(c.id)}>
              <Text style={styles.link}>View certificate</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
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
  meta: { fontSize: 13, color: theme.color.textPrimary, marginTop: 4 },
  date: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2 },
  link: { color: theme.color.primary, fontSize: 13, fontWeight: "600", marginTop: theme.spacing.sm },
});
