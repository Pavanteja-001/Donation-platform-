import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchTopSupporters, type TopSupporter } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { SupporterRow } from "../components/CommunityBlocks";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";

/**
 * The leaderboard, ranked purely on confirmed money donated.
 *
 * The note at the top is not decoration: a donor who gave blood and does not appear here will
 * otherwise read this as the platform ignoring their contribution. Saying what the ranking
 * measures is what stops that.
 */
export function TopSupportersScreen() {
  const { token } = useAuth();
  const [supporters, setSupporters] = useState<TopSupporter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { supporters: list } = await fetchTopSupporters(token, 50);
      setSupporters(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load supporters");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  if (error && !supporters) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.notice}>
        <Feather name="info" size={15} color={theme.color.primary} />
        <Text style={styles.noticeText}>
          Ranked by total confirmed donations. Blood and goods contributions matter just as much — they simply
          aren&apos;t measured in rupees.
        </Text>
      </View>

      {!supporters ? (
        <View style={styles.list}>
          <View style={styles.card}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={36} height={36} radius={18} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="55%" height={13} />
                  <Skeleton width="25%" height={11} />
                </View>
                <Skeleton width={64} height={13} />
              </View>
            ))}
          </View>
        </View>
      ) : supporters.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="award"
            title="No confirmed donations yet"
            subtitle="Once a beneficiary confirms a donation, the donor appears here."
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ flex: 1 }}>
          <FlashList
            data={supporters}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.rowWrap}>
                <SupporterRow supporter={item} />
              </View>
            )}
            contentContainerStyle={styles.list}
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  notice: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    marginBottom: 0,
  },
  noticeText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1, lineHeight: 17 },
  list: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    paddingHorizontal: theme.spacing.md,
  },
  // Each row is its own card so the ranking reads as a list of people rather than a table.
  rowWrap: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.elevation.level1,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
});
