import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchSuccessStories, type SuccessStoryCard } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatEventDate } from "../lib/community";
import { EmptyState, ErrorState, PressableScale, Skeleton } from "../components/ui";

/**
 * The full stories list.
 *
 * A taller card than the drawer's carousel version, with the cover image on top: at full screen
 * width the drawer's 84dp thumbnail would leave a photo of a person barely recognisable, and the
 * photo is most of why anyone opens this screen.
 */
function StoryListCard({ story, onPress }: { story: SuccessStoryCard; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, theme.elevation.level2]}>
      {story.coverImageUrl ? (
        <Image
          source={{ uri: story.coverImageUrl }}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Feather name="heart" size={26} color={theme.color.primary} />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {story.title}
        </Text>
        <Text style={styles.summary} numberOfLines={3}>
          {story.summary}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {[story.beneficiaryName, formatEventDate(story.publishedAt)].filter(Boolean).join(" · ")}
          </Text>
          <View style={styles.readMoreRow}>
            <Text style={styles.readMore}>Read more</Text>
            <Feather name="arrow-right" size={13} color={theme.color.primary} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function SuccessStoriesScreen({ onSelect }: { onSelect: (story: SuccessStoryCard) => void }) {
  const { token } = useAuth();
  const [stories, setStories] = useState<SuccessStoryCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { stories: list } = await fetchSuccessStories(token, 50);
      setStories(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load stories");
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

  if (error && !stories) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!stories) {
    return (
      <View style={[styles.screen, { padding: theme.spacing.lg, gap: theme.spacing.lg }]}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton width="100%" height={150} radius={0} />
            <View style={{ padding: theme.spacing.md, gap: 8 }}>
              <Skeleton width="75%" height={17} />
              <Skeleton width="95%" height={13} />
              <Skeleton width="60%" height={13} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="book-open"
          title="No stories published yet"
          subtitle="When a need is fulfilled, the team writes up what your support changed — those stories appear here."
        />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={styles.screen}>
      <FlashList
        data={stories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StoryListCard story={item} onPress={() => onSelect(item)} />}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    marginBottom: theme.spacing.lg,
    overflow: "hidden",
  },
  cover: { width: "100%", height: 160, backgroundColor: theme.color.surfaceSunken },
  coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: theme.color.primarySoft },
  cardBody: { padding: theme.spacing.md, gap: 6 },
  title: { ...theme.typography.h3, color: theme.color.textPrimary },
  summary: { ...theme.typography.bodySmall, color: theme.color.textSecondary, lineHeight: 19 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  meta: { ...theme.typography.caption, color: theme.color.textTertiary, flex: 1 },
  readMoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  readMore: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700" },
});
