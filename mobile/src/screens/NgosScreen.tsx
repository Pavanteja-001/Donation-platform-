import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchNgos, type Ngo } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Gradient } from "../components/Gradient";
import { IconPlate } from "../components/Depth";
import { EmptyState, ErrorState, Input, Skeleton, PressableScale } from "../components/ui";

function NgoCard({ ngo, onPress }: { ngo: Ngo; onPress: () => void }) {
  const cover = ngo.coverPhotoUrl ?? ngo.galleryPhotos[0] ?? null;
  const location = [ngo.area, ngo.city].filter(Boolean).join(", ");

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, theme.elevation.level2]}>
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />

      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={200} />
      ) : (
        <View style={styles.thumbFallback}>
          <IconPlate icon="users" size="lg" tone="brand" />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {ngo.name ?? ngo.legalName ?? "Organisation"}
        </Text>

        {location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={theme.color.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        {ngo.about ? (
          <Text style={styles.about} numberOfLines={2}>
            {ngo.about}
          </Text>
        ) : null}

        {/* Team and volunteer counts are the trust signal a donor scans for — an organisation
            with people behind it reads differently from an empty listing. */}
        <View style={styles.statRow}>
          {!!ngo.teamCount && (
            <View style={styles.statPill}>
              <Feather name="user" size={11} color={theme.color.primary} />
              <Text style={styles.statText}>{ngo.teamCount} team</Text>
            </View>
          )}
          {!!ngo.volunteerCount && (
            <View style={styles.statPill}>
              <Feather name="heart" size={11} color={theme.color.primary} />
              <Text style={styles.statText}>{ngo.volunteerCount} volunteers</Text>
            </View>
          )}
        </View>
      </View>

      <Feather name="chevron-right" size={20} color={theme.color.textTertiary} />
    </PressableScale>
  );
}

export function NgosScreen({ onSelect }: { onSelect: (ngo: Ngo) => void }) {
  const { token } = useAuth();
  const [ngos, setNgos] = useState<Ngo[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (term: string) => {
      if (!token) return;
      try {
        const { ngos: list } = await fetchNgos(token, term.trim() || undefined);
        setNgos(list);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load organisations");
      }
    },
    [token]
  );

  // Debounced so typing doesn't fire a request per keystroke (and let an earlier response
  // overwrite a later one).
  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(search);
    setIsRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <Input label="" placeholder="Search NGOs by name or city…" icon="search" value={search} onChangeText={setSearch} />
      </View>

      {error && !ngos ? (
        <View style={styles.centered}>
          <ErrorState message={error} onRetry={() => load(search)} />
        </View>
      ) : !ngos ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, { gap: theme.spacing.md }]}>
              <Skeleton width={72} height={72} radius={theme.radii.lg} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="70%" height={17} />
                <Skeleton width="50%" height={13} />
                <Skeleton width="85%" height={13} />
              </View>
            </View>
          ))}
        </View>
      ) : ngos.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="users"
            title={search ? "No organisations match that search" : "No NGOs listed yet"}
            subtitle={
              search
                ? "Try a different name or city."
                : "Verified NGOs appear here once an administrator approves them."
            }
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ flex: 1 }}>
          <FlashList
            data={ngos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <NgoCard ngo={item} onPress={() => onSelect(item)} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
  searchWrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxl },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
  },
  thumb: { width: 72, height: 72, borderRadius: theme.radii.lg, backgroundColor: theme.color.surfaceMuted },
  thumbFallback: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  name: { ...theme.typography.h3, color: theme.color.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },
  about: { ...theme.typography.caption, color: theme.color.textSecondary, lineHeight: 16 },
  statRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: 4 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.primarySoft,
  },
  statText: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700", fontSize: 11 },
});
