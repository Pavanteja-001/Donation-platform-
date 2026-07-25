import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchMyContributions, type Contribution } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { EmptyState, ErrorState, Skeleton, Badge, type BadgeTone } from "../components/ui";

const STATUS_BADGE_TONE: Record<Contribution["status"], BadgeTone> = {
  PENDING_CONFIRMATION: "accent",
  CONFIRMED: "primary",
  REJECTED: "danger",
};

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
          <Skeleton width="40%" height={12} />
          <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

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

  if (!contributions) {
    return <ContributionsListSkeleton />;
  }

  if (contributions.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="You haven't contributed to anything yet"
          subtitle="Your contributions history will appear here once you make a donation or pledge."
        />
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
            <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
              <Text style={styles.title} numberOfLines={1}>
                {c.need?.title ?? "—"}
              </Text>
            </View>
            <Badge label={c.status.replace("_", " ")} tone={STATUS_BADGE_TONE[c.status]} />
          </View>
          <Text style={styles.meta}>{summarize(c)}</Text>
          <Text style={styles.date}>{formatDate(c.createdAt)}</Text>
          {c.status === "CONFIRMED" && (
            <TouchableOpacity onPress={() => onViewCertificate(c.id)} activeOpacity={0.7}>
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
  meta: { fontSize: 13, color: theme.color.textPrimary, marginTop: 4 },
  date: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2 },
  link: { color: theme.color.primary, fontSize: 13, fontWeight: "600", marginTop: theme.spacing.sm },
});
