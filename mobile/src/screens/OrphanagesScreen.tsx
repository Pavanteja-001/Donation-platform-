import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchOrphanages, type Orphanage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Gradient } from "../components/Gradient";
import { IconPlate } from "../components/Depth";
import { EmptyState, ErrorState, Input, Skeleton, PressableScale } from "../components/ui";

/** Lowest sponsorship price on offer — what a donor scans for first. */
function fromPrice(home: Orphanage): number | null {
  const prices = [home.breakfastCost, home.lunchCost, home.dinnerCost].filter(
    (p): p is number => typeof p === "number"
  );
  return prices.length > 0 ? Math.min(...prices) : null;
}

function HomeCard({ home, onPress }: { home: Orphanage; onPress: () => void }) {
  const cover = home.coverPhotoUrl ?? home.galleryPhotos[0] ?? null;
  const location = [home.area, home.city].filter(Boolean).join(", ");
  const price = fromPrice(home);

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, theme.elevation.level2]}>
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />

      {/* A real photo when the home has uploaded one, otherwise a lit plate — never an empty
          grey box, which reads as a broken image rather than a home without a picture. */}
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={200} />
      ) : (
        <View style={styles.thumbFallback}>
          <IconPlate icon="home" size="lg" tone="brand" />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {home.name ?? home.legalName ?? "Home"}
        </Text>

        {location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={theme.color.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        <View style={styles.statRow}>
          {home.childrenCount != null && (
            <Text style={styles.statText}>
              <Text style={styles.statNumber}>{home.childrenCount}</Text> residents
            </Text>
          )}
          {price != null && (
            <Text style={styles.statText}>
              from <Text style={styles.statNumber}>₹{price.toLocaleString("en-IN")}</Text>
            </Text>
          )}
        </View>

        {!home.acceptingBookings && (
          <View style={styles.closedPill}>
            <Feather name="pause-circle" size={11} color={theme.color.warning} />
            <Text style={styles.closedText}>Not accepting bookings</Text>
          </View>
        )}
      </View>

      <Feather name="chevron-right" size={20} color={theme.color.textTertiary} />
    </PressableScale>
  );
}

export function OrphanagesScreen({ onSelect }: { onSelect: (home: Orphanage) => void }) {
  const { token } = useAuth();
  const [homes, setHomes] = useState<Orphanage[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (term: string) => {
      if (!token) return;
      try {
        const { orphanages } = await fetchOrphanages(token, term.trim() || undefined);
        setHomes(orphanages);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load homes");
      }
    },
    [token]
  );

  // Debounced: the search box filters server-side, and a request per keystroke would both
  // hammer the API and let an earlier response overwrite a later one.
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
        <Input
          label=""
          placeholder="Search homes by name or city…"
          icon="search"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {error && !homes ? (
        <View style={styles.centered}>
          <ErrorState message={error} onRetry={() => load(search)} />
        </View>
      ) : !homes ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, { gap: theme.spacing.md }]}>
              <Skeleton width={72} height={72} radius={theme.radii.lg} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="70%" height={17} />
                <Skeleton width="50%" height={13} />
                <Skeleton width="40%" height={13} />
              </View>
            </View>
          ))}
        </View>
      ) : homes.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="home"
            title={search ? "No homes match that search" : "No homes listed yet"}
            subtitle={
              search
                ? "Try a different name or city."
                : "Verified orphanages and old-age homes will appear here once they've been approved."
            }
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ flex: 1 }}>
          <FlashList
            data={homes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <HomeCard home={item} onPress={() => onSelect(item)} />}
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
  statRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginTop: 2 },
  statText: { ...theme.typography.caption, color: theme.color.textSecondary },
  statNumber: { fontWeight: "800", color: theme.color.textPrimary },
  closedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.warningSoft,
  },
  closedText: { ...theme.typography.caption, color: theme.color.warning, fontWeight: "700", fontSize: 11 },
});
