import { useCallback, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchOrphanage, type MealType, type Orphanage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Gradient } from "../components/Gradient";
import { IconPlate } from "../components/Depth";
import { Button, ErrorState, PressableScale, Skeleton } from "../components/ui";

const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner" };

function StatBlock({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />
      <Text style={styles.statValue}>{value ?? "—"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function OrphanageDetailScreen({
  orphanageId,
  initial,
  onBook,
}: {
  orphanageId: string;
  initial?: Orphanage;
  onBook: (home: Orphanage) => void;
}) {
  const { token } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [home, setHome] = useState<Orphanage | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { orphanage } = await fetchOrphanage(token, orphanageId);
      setHome(orphanage);
      setError(null);
    } catch (err) {
      if (!home) setError(err instanceof Error ? err.message : "Couldn't load this home");
    }
    // `home` is intentionally excluded — it changes on every fetch and would re-trigger the
    // focus effect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orphanageId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (error && !home) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!home) {
    return (
      <View style={styles.screen}>
        <Skeleton width="100%" height={220} radius={0} />
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={60} />
        </View>
      </View>
    );
  }

  const cover = home.coverPhotoUrl ?? home.galleryPhotos[0] ?? null;
  const location = [home.area, home.city].filter(Boolean).join(", ");
  const meals: { type: MealType; cost: number | null }[] = [
    { type: "BREAKFAST", cost: home.breakfastCost },
    { type: "LUNCH", cost: home.lunchCost },
    { type: "DINNER", cost: home.dinnerCost },
  ];
  const offered = meals.filter((m) => m.cost != null);
  const canBook = home.acceptingBookings && offered.length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.hero} contentFit="cover" cachePolicy="memory-disk" transition={220} />
        ) : (
          <Gradient colors={theme.gradient.heroDeep} direction="diagonal" style={styles.hero}>
            <View style={styles.heroFallback}>
              <IconPlate icon="home" size="lg" tone="neutral" />
            </View>
          </Gradient>
        )}

        <Animated.View entering={FadeInDown.duration(360)} style={styles.body}>
          <Text style={styles.name}>{home.name ?? home.legalName ?? "Home"}</Text>

          {location ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={14} color={theme.color.textSecondary} />
              <Text style={styles.metaText}>{location}</Text>
            </View>
          ) : null}

          {home.address ? <Text style={styles.address}>{home.address}</Text> : null}

          {home.about ? <Text style={styles.about}>{home.about}</Text> : null}

          <View style={styles.statsRow}>
            <StatBlock value={home.childrenCount} label="Residents" />
            <StatBlock value={home.staffCount} label="Staff" />
            <StatBlock value={home.roomsCount} label="Rooms" />
          </View>

          {/* Prices are shown here, before the booking screen, so a donor knows the commitment
              before investing time in picking a date. */}
          {offered.length > 0 && (
            <View style={styles.mealCard}>
              <Text style={styles.sectionTitle}>Sponsor a meal</Text>
              {offered.map((m) => (
                <View key={m.type} style={styles.mealRow}>
                  <Text style={styles.mealName}>{MEAL_LABEL[m.type]}</Text>
                  <Text style={styles.mealCost}>₹{m.cost!.toLocaleString("en-IN")}</Text>
                </View>
              ))}
            </View>
          )}

          {/* The home's own photos of its work. Horizontal so a long gallery doesn't push the
              booking CTA off the screen, and tappable for a full-screen look. */}
          {home.galleryPhotos.length > 0 && (
            <View style={styles.gallerySection}>
              <Text style={styles.sectionTitle}>Their work</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryRow}
              >
                {home.galleryPhotos.map((url, i) => (
                  <PressableScale key={url} onPress={() => setViewerIndex(i)} scaleTo={0.97} accessibilityLabel={`Photo ${i + 1}`}>
                    <Image
                      source={{ uri: url }}
                      style={styles.galleryImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          )}

          {!home.acceptingBookings && (
            <View style={styles.notice}>
              <Feather name="pause-circle" size={15} color={theme.color.warning} />
              <Text style={styles.noticeText}>
                This home isn't accepting bookings at the moment. Check back later.
              </Text>
            </View>
          )}

          {home.acceptingBookings && offered.length === 0 && (
            <View style={styles.notice}>
              <Feather name="info" size={15} color={theme.color.info} />
              <Text style={styles.noticeText}>This home hasn't set up meal sponsorship yet.</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal visible={viewerIndex !== null} transparent animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * screenWidth, y: 0 }}
          >
            {home.galleryPhotos.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={{ width: screenWidth, height: "100%" }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ))}
          </ScrollView>
          <PressableScale
            onPress={() => setViewerIndex(null)}
            scaleTo={0.9}
            hitSlop={12}
            accessibilityLabel="Close photo"
            style={styles.viewerClose}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </PressableScale>
        </View>
      </Modal>

      {/* Pinned CTA — the whole point of the screen shouldn't require scrolling to reach. */}
      <View style={[styles.footer, theme.elevation.level3, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
        <Button
          label={canBook ? "Book a slot" : "Booking unavailable"}
          icon="calendar"
          onPress={() => onBook(home)}
          disabled={!canBook}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  content: { paddingBottom: 120 },

  hero: { width: "100%", height: 220, backgroundColor: theme.color.surfaceMuted },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },

  body: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  name: { ...theme.typography.h1, color: theme.color.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  address: { ...theme.typography.caption, color: theme.color.textTertiary },
  about: { ...theme.typography.body, color: theme.color.textSecondary, marginTop: theme.spacing.sm, lineHeight: 22 },

  statsRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  statBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.surface,
    overflow: "hidden",
    ...theme.elevation.level1,
  },
  statValue: { ...theme.typography.h2, color: theme.color.textPrimary },
  statLabel: { ...theme.typography.caption, color: theme.color.textSecondary },

  mealCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.surface,
    gap: theme.spacing.sm,
    ...theme.elevation.level1,
  },
  sectionTitle: { ...theme.typography.h3, color: theme.color.textPrimary, marginBottom: 2 },
  mealRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  gallerySection: { marginTop: theme.spacing.xl, gap: theme.spacing.sm },
  galleryRow: { gap: theme.spacing.sm, paddingRight: theme.spacing.lg },
  galleryImage: {
    width: 150,
    height: 110,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surfaceMuted,
  },
  viewer: { flex: 1, backgroundColor: "rgba(10,6,7,0.96)" },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  mealName: { ...theme.typography.bodyMedium, color: theme.color.textPrimary },
  mealCost: { ...theme.typography.bodyMedium, color: theme.color.primary, fontWeight: "800" },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.warningSoft,
  },
  noticeText: { ...theme.typography.caption, color: theme.color.textSecondary, flex: 1 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.lg,
    // paddingBottom comes from the safe-area inset at render time — a fixed value puts the
    // button under the gesture bar on tall Android phones.
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
});
