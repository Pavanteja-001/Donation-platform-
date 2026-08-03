import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchEvents, type PlatformEventCard } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { eventSubtitle } from "../lib/community";
import { EmptyState, ErrorState, PressableScale, Skeleton } from "../components/ui";

type Scope = "upcoming" | "past";

function EventListCard({ event, onPress }: { event: PlatformEventCard; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, theme.elevation.level2]}>
      {event.bannerUrl ? (
        <Image
          source={{ uri: event.bannerUrl }}
          style={styles.banner}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : null}

      <View style={styles.cardBody}>
        <View style={styles.iconTile}>
          {event.iconUrl ? (
            <Image source={{ uri: event.iconUrl }} style={styles.iconImage} contentFit="cover" transition={150} />
          ) : (
            <Feather name={event.mode === "ONLINE" ? "video" : "calendar"} size={19} color={theme.color.primary} />
          )}
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {eventSubtitle(event)}
          </Text>
          {event.eventType ? (
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{event.eventType}</Text>
            </View>
          ) : null}
        </View>

        <Feather name="chevron-right" size={18} color={theme.color.textTertiary} />
      </View>
    </PressableScale>
  );
}

/**
 * Every published event, split into what is still to come and what already happened.
 *
 * Past events stay reachable rather than being deleted: a camp that ran last month is evidence
 * the platform does what it says, and someone who missed it wants to know these happen regularly.
 */
export function EventsScreen({ onSelect }: { onSelect: (event: PlatformEventCard) => void }) {
  const { token } = useAuth();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [events, setEvents] = useState<PlatformEventCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (which: Scope) => {
      if (!token) return;
      try {
        const { events: list } = await fetchEvents(token, which, 50);
        setEvents(list);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load events");
      }
    },
    [token]
  );

  useEffect(() => {
    // Clear first: keeping the previous scope's rows on screen while the new ones load would
    // show "past" events under the "Upcoming" tab for as long as the request takes.
    setEvents(null);
    void load(scope);
  }, [scope, load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(scope);
    setIsRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        {(["upcoming", "past"] as Scope[]).map((option) => (
          <PressableScale
            key={option}
            onPress={() => setScope(option)}
            scaleTo={0.97}
            style={[styles.tab, scope === option && styles.tabActive]}
          >
            <Text style={[styles.tabText, scope === option && styles.tabTextActive]}>
              {option === "upcoming" ? "Upcoming" : "Past"}
            </Text>
          </PressableScale>
        ))}
      </View>

      {error && !events ? (
        <View style={styles.centered}>
          <ErrorState message={error} onRetry={() => load(scope)} />
        </View>
      ) : !events ? (
        <View style={styles.listContent}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.card, { marginBottom: theme.spacing.lg }]}>
              <Skeleton width="100%" height={120} radius={0} />
              <View style={{ padding: theme.spacing.md, gap: 8 }}>
                <Skeleton width="70%" height={15} />
                <Skeleton width="45%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : events.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="calendar"
            title={scope === "upcoming" ? "No upcoming events" : "No past events"}
            subtitle={
              scope === "upcoming"
                ? "Health camps, workshops and donation drives will be announced here."
                : "Events that have already taken place will be listed here."
            }
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ flex: 1 }}>
          <FlashList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <EventListCard event={item} onPress={() => onSelect(item)} />}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  tabs: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  tab: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.surfaceMuted,
  },
  tabActive: { backgroundColor: theme.color.primary },
  tabText: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textSecondary },
  tabTextActive: { color: theme.color.onPrimary },
  listContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
  },
  banner: { width: "100%", height: 130, backgroundColor: theme.color.surfaceSunken },
  cardBody: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: { width: "100%", height: "100%" },
  title: { ...theme.typography.bodyMedium, color: theme.color.textPrimary },
  meta: { ...theme.typography.caption, color: theme.color.textSecondary },
  typeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.primarySoft,
    marginTop: 2,
  },
  typeChipText: { fontSize: 10, fontWeight: "800", color: theme.color.primary },
});
