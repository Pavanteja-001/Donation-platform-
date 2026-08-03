import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchSuccessStory, type SuccessStory, type SuccessStoryCard } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatEventDate } from "../lib/community";
import { ErrorState, Skeleton } from "../components/ui";

/**
 * One success story in full.
 *
 * `initial` is the card the user tapped: title, summary and cover are painted from it on the
 * first frame, so opening a story never shows an empty screen — only the body and gallery wait
 * on the network.
 */
export function SuccessStoryDetailScreen({
  storyId,
  initial,
}: {
  storyId: string;
  initial?: SuccessStoryCard;
}) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [story, setStory] = useState<SuccessStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { story: full } = await fetchSuccessStory(token, storyId);
      setStory(full);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this story");
    }
  }, [token, storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = story?.title ?? initial?.title;
  const summary = story?.summary ?? initial?.summary;
  const cover = story?.coverImageUrl ?? initial?.coverImageUrl ?? null;
  const beneficiary = story?.beneficiaryName ?? initial?.beneficiaryName ?? null;
  const publishedAt = story?.publishedAt ?? initial?.publishedAt ?? null;

  // Only a hard failure with nothing cached from the list is worth taking over the screen.
  if (error && !story && !initial) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  const galleryWidth = width - theme.spacing.lg * 2;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" transition={220} />
      ) : null}

      <View style={styles.body}>
        {title ? <Text style={styles.title}>{title}</Text> : <Skeleton width="80%" height={26} />}

        {(beneficiary || publishedAt) && (
          <View style={styles.metaRow}>
            {beneficiary ? (
              <View style={styles.metaChip}>
                <Feather name="user" size={11} color={theme.color.primary} />
                <Text style={styles.metaChipText}>{beneficiary}</Text>
              </View>
            ) : null}
            {publishedAt ? <Text style={styles.date}>{formatEventDate(publishedAt)}</Text> : null}
          </View>
        )}

        {summary ? <Text style={styles.summary}>{summary}</Text> : null}

        {story ? (
          <Animated.Text entering={FadeIn.duration(theme.motion.normal)} style={styles.storyBody}>
            {story.body}
          </Animated.Text>
        ) : (
          <View style={{ gap: 10, marginTop: theme.spacing.sm }}>
            <Skeleton width="100%" height={13} />
            <Skeleton width="96%" height={13} />
            <Skeleton width="88%" height={13} />
            <Skeleton width="92%" height={13} />
          </View>
        )}

        {story && story.images.length > 0 ? (
          <View style={styles.gallery}>
            <Text style={styles.galleryLabel}>PHOTOS</Text>
            {story.images.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.galleryImage, { width: galleryWidth, height: galleryWidth * 0.62 }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ))}
          </View>
        ) : null}

        {/* A story is a record of what donors did, not a solicitation — but it is also the best
            moment to mention that the same thing is still possible. */}
        <View style={styles.footerNote}>
          <Feather name="heart" size={14} color={theme.color.primary} />
          <Text style={styles.footerText}>Made possible by donors on this platform.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingBottom: theme.spacing.xxl },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl, flex: 1 },
  cover: { width: "100%", height: 220, backgroundColor: theme.color.surfaceSunken },
  body: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { ...theme.typography.h1, color: theme.color.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.primarySoft,
  },
  metaChipText: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700" },
  date: { ...theme.typography.caption, color: theme.color.textTertiary },
  summary: {
    ...theme.typography.bodyMedium,
    color: theme.color.textPrimary,
    lineHeight: 23,
    marginTop: theme.spacing.xs,
  },
  storyBody: { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 24 },
  gallery: { gap: theme.spacing.md, marginTop: theme.spacing.md },
  galleryLabel: { ...theme.typography.overline, color: theme.color.textTertiary },
  galleryImage: { borderRadius: theme.radii.lg, backgroundColor: theme.color.surfaceSunken },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.primarySoft,
  },
  footerText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
});
