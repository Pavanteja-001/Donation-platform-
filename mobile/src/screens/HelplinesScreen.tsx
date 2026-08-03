import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchHelplines, type Helpline } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { dial } from "../lib/community";
import { HelplineRow } from "../components/CommunityBlocks";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";

/**
 * Every published helpline, grouped by the category an admin gave it.
 *
 * Grouping is derived, not configured: whatever distinct `category` values exist become the
 * headings, in the order the helplines are sorted. That way an admin adding "Disaster relief"
 * gets a new section without anyone shipping an app update, and helplines with no category still
 * appear (under "Other helplines") instead of vanishing.
 */
function groupByCategory(helplines: Helpline[]): { title: string; items: Helpline[] }[] {
  const groups: { title: string; items: Helpline[] }[] = [];
  for (const helpline of helplines) {
    const title = helpline.category?.trim() || "Other helplines";
    const existing = groups.find((g) => g.title === title);
    if (existing) existing.items.push(helpline);
    else groups.push({ title, items: [helpline] });
  }
  return groups;
}

export function HelplinesScreen() {
  const { token } = useAuth();
  const [helplines, setHelplines] = useState<Helpline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { helplines: list } = await fetchHelplines(token);
      setHelplines(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load helplines");
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

  if (error && !helplines) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.color.primary}
          colors={[theme.color.primary]}
        />
      }
    >
      {/* These are public national/state services, not something this platform operates. Saying
          so plainly matters: a person in a crisis should know they are calling the helpline
          itself, and should not wait on us for an answer. */}
      <View style={styles.notice}>
        <Feather name="info" size={15} color={theme.color.primary} />
        <Text style={styles.noticeText}>
          These are public helplines run by government and non-profit services. Tap any number to call it directly.
        </Text>
      </View>

      {!helplines ? (
        <View style={styles.card}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={34} height={34} radius={17} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={13} />
                <Skeleton width="35%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : helplines.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="phone-off"
            title="No helplines published yet"
            subtitle="Emergency numbers appear here once an administrator adds them."
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ gap: theme.spacing.lg }}>
          {groupByCategory(helplines).map((group) => (
            <View key={group.title}>
              <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
              <View style={styles.card}>
                {group.items.map((helpline) => (
                  <HelplineRow key={helpline.id} helpline={helpline} onPress={() => void dial(helpline.number)} />
                ))}
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl, flexGrow: 1 },
  notice: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
  },
  noticeText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1, lineHeight: 17 },
  groupTitle: {
    ...theme.typography.overline,
    color: theme.color.textTertiary,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    ...theme.elevation.level1,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
});
