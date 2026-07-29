import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchGoods, type GoodsDirection, type GoodsPayload, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { useBottomInset } from "../lib/safeArea";
import { Gradient } from "../components/Gradient";
import { IconPlate } from "../components/Depth";
import { Button, Chip, EmptyState, ErrorState, PressableScale, Skeleton } from "../components/ui";

/**
 * The two halves of the goods exchange.
 *
 * OFFER first, deliberately. Someone arriving here is far more often browsing for something they
 * could use than auditing what's wanted — and the offers side is the one this screen exists to
 * make possible, since requests were already reachable from the main feed.
 */
const TABS: { id: GoodsDirection; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "OFFER", label: "Available to take", icon: "gift" },
  { id: "REQUEST", label: "Wanted", icon: "search" },
];

function goodsOf(need: Need): Partial<GoodsPayload> {
  return (need.payload ?? {}) as Partial<GoodsPayload>;
}

function GoodsCard({ need, direction, onPress }: { need: Need; direction: GoodsDirection; onPress: () => void }) {
  const goods = goodsOf(need);
  const photo = need.photos[0] ?? null;
  const location = [need.area, need.city].filter(Boolean).join(", ");
  const quantity = goods.quantity ?? 1;

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.card, theme.elevation.level2]}>
      <Gradient
        colors={theme.gradient.surfaceSheen}
        direction="diagonal"
        style={StyleSheet.absoluteFill as never}
        pointerEvents="none"
      />

      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={200} />
      ) : (
        <View style={styles.thumbFallback}>
          <IconPlate icon="package" size="lg" tone={direction === "OFFER" ? "brand" : "neutral"} />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {need.title}
        </Text>

        {goods.item ? (
          <Text style={styles.item} numberOfLines={1}>
            {goods.item}
          </Text>
        ) : null}

        <View style={styles.tagRow}>
          {goods.condition ? (
            <View style={styles.tag}>
              <Feather name="check-circle" size={10} color={theme.color.primary} />
              <Text style={styles.tagText} numberOfLines={1}>
                {goods.condition}
              </Text>
            </View>
          ) : null}
          {quantity > 1 && (
            <View style={styles.tag}>
              <Feather name="hash" size={10} color={theme.color.primary} />
              <Text style={styles.tagText}>{quantity}</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Feather name="user" size={11} color={theme.color.textTertiary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {need.postedBy.name ?? "Someone"}
            {location ? ` · ${location}` : ""}
          </Text>
        </View>
      </View>

      <Feather name="chevron-right" size={20} color={theme.color.textTertiary} />
    </PressableScale>
  );
}

export function GoodsScreen({
  onSelectNeed,
  onDonateItem,
  onRequestItem,
}: {
  onSelectNeed: (need: Need) => void;
  onDonateItem: () => void;
  onRequestItem: () => void;
}) {
  const { token } = useAuth();
  const bottomInset = useBottomInset();
  const [direction, setDirection] = useState<GoodsDirection>("OFFER");
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Which tab the newest in-flight request belongs to. Switching chips twice quickly can land the
  // responses out of order, and without this the slower first response overwrites the second —
  // leaving one tab's items sitting under the other tab's heading.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (dir: GoodsDirection) => {
      if (!token) return;
      const requestId = ++latestRequest.current;
      try {
        const { needs: list } = await fetchGoods(token, dir);
        if (requestId !== latestRequest.current) return;
        setNeeds(list);
        setError(null);
      } catch (err) {
        if (requestId !== latestRequest.current) return;
        setError(err instanceof Error ? err.message : "Couldn't load items");
      }
    },
    [token]
  );

  // Blanked before fetching so switching tabs shows the skeleton rather than the other tab's
  // items sitting there under the wrong heading. Also covers the first mount, so there is no
  // separate focus fetch racing it.
  useEffect(() => {
    setNeeds(null);
    load(direction);
  }, [direction, load]);

  // A listing approved while you were away should appear when you come back — but not on the
  // first focus, which the effect above has already handled.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      load(direction);
    }, [direction, load])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(direction);
    setIsRefreshing(false);
  }

  const isOffers = direction === "OFFER";

  return (
    <View style={styles.screen}>
      {/* The line that used to sit on the Explore card. It belongs here, where it doubles as an
          explanation of what the two chips below actually split. */}
      <Text style={styles.intro}>
        Give away something you no longer use, or ask for something you need.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        keyboardShouldPersistTaps="handled"
        // Without this the rail grows to fill the flex column and drags the chips to full height
        // with it — a horizontal ScrollView has to be told to hug its content vertically.
        style={styles.tabRail}
      >
        {TABS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            icon={t.icon}
            active={direction === t.id}
            onPress={() => setDirection(t.id)}
          />
        ))}
      </ScrollView>

      {error && !needs ? (
        <View style={styles.centered}>
          <ErrorState message={error} onRetry={() => load(direction)} />
        </View>
      ) : !needs ? (
        // `flex: 1` matters: without it this branch is only as tall as three skeleton cards, the
        // footer slides up to meet it, and the buttons visibly jump down the moment data lands.
        <View style={[styles.listContent, styles.fill]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, { gap: theme.spacing.md }]}>
              <Skeleton width={78} height={78} radius={theme.radii.lg} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="80%" height={17} />
                <Skeleton width="55%" height={13} />
                <Skeleton width="40%" height={13} />
              </View>
            </View>
          ))}
        </View>
      ) : needs.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon={isOffers ? "gift" : "search"}
            title={isOffers ? "Nothing on offer right now" : "Nobody has asked for an item yet"}
            subtitle={
              isOffers
                ? "Items people are giving away appear here once an administrator approves them. Have something spare? List it below."
                : "Requests for items appear here once verified."
            }
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ flex: 1 }}>
          <FlashList
            data={needs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GoodsCard need={item} direction={direction} onPress={() => onSelectNeed(item)} />
            )}
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

      {/* The action always matches the tab you're on: browsing what's available is when you think
          "I have one of those too", and browsing what's wanted is when you think "I need one". */}
      <View style={[styles.cta, { paddingBottom: bottomInset }]}>
        <Button
          label={isOffers ? "Donate an item" : "Request an item"}
          icon={isOffers ? "gift" : "plus"}
          onPress={isOffers ? onDonateItem : onRequestItem}
        />
        <Text style={styles.ctaNote}>Listings go live once an administrator approves them.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  fill: { flex: 1 },
  intro: {
    ...theme.typography.caption,
    color: theme.color.textSecondary,
    lineHeight: 18,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  tabRail: { flexGrow: 0, flexShrink: 0 },
  tabRow: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },

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
  thumb: { width: 78, height: 78, borderRadius: theme.radii.lg, backgroundColor: theme.color.surfaceMuted },
  thumbFallback: {
    width: 78,
    height: 78,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 4 },
  title: { ...theme.typography.h3, color: theme.color.textPrimary },
  item: { ...theme.typography.caption, color: theme.color.textSecondary },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: 2 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.primarySoft,
  },
  tagText: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700", fontSize: 11 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { ...theme.typography.caption, color: theme.color.textTertiary, flex: 1 },

  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.xs,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  ctaNote: { ...theme.typography.caption, color: theme.color.textTertiary, textAlign: "center" },
});
