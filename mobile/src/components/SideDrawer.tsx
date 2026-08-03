import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import type { AppNavigationProp } from "../navigation/types";
import { theme } from "../lib/theme";
import { PressableScale, Skeleton } from "./ui";
import { useAuth } from "../context/AuthContext";
import { fetchCommunityMenu, type CommunityMenu } from "../lib/api";
import { dial } from "../lib/community";
import {
  Dots,
  EventRow,
  HelplineRow,
  ImpactCta,
  SectionCard,
  StoryCard,
  SupporterRow,
  TrustPoints,
} from "./CommunityBlocks";

/**
 * The right-edge drawer.
 *
 * Never the full screen: the strip of home screen still visible on the left is what tells you
 * this is a panel over the page rather than a new page you navigated to — so tapping outside to
 * dismiss is discoverable instead of something you have to guess.
 *
 * Widened from 0.75 when the community panel moved in. At 75% the "Make an impact" card had
 * roughly 130dp for its text column next to the artwork, which forced "Create a Need" onto two
 * lines on a 360dp phone.
 */
const WIDTH_FRACTION = 0.86;

/**
 * How long a loaded menu payload stays good.
 *
 * The drawer is opened and dismissed constantly, and this content changes when an admin edits
 * it — perhaps weekly. Refetching on every open would cost a request per tap for content that is
 * already correct; never refetching would pin a stale helpline number for the whole session.
 */
const MENU_TTL_MS = 5 * 60 * 1000;

interface DrawerLink {
  icon?: keyof typeof Feather.glyphMap;
  imageIcon?: number;
  label: string;
  hint?: string;
  onPress: () => void;
}

export function SideDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AppNavigationProp>();
  const { token } = useAuth();
  const panelWidth = width * WIDTH_FRACTION;
  /** The story carousel pages one card at a time, so a page is the panel minus its padding. */
  const storyWidth = panelWidth - theme.spacing.lg * 2 - theme.spacing.md * 2;

  const progress = useSharedValue(0);

  const [menu, setMenu] = useState<CommunityMenu | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [storyPage, setStoryPage] = useState(0);
  const loadedAt = useRef(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      // Slightly faster out than in: a panel that lingers on dismissal reads as unresponsive,
      // while an entrance that rushes reads as jarring.
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const loadMenu = useCallback(async () => {
    if (!token) return;
    try {
      const payload = await fetchCommunityMenu(token);
      setMenu(payload);
      setMenuError(null);
      loadedAt.current = Date.now();
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : "Couldn't load this menu");
    }
  }, [token]);

  // Fetch on open, not on mount: the drawer is rendered (collapsed) on every screen that hosts
  // it, so loading at mount would fire this request on app start for a panel nobody has opened.
  useEffect(() => {
    if (!visible) return;
    if (menu && Date.now() - loadedAt.current < MENU_TTL_MS) return;
    void loadMenu();
  }, [visible, menu, loadMenu]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * panelWidth }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // Android's hardware back should close the drawer, not leave the screen underneath it.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  /** Navigate, but close first — otherwise the drawer is still open when you come back. */
  const go = (action: () => void) => () => {
    onClose();
    action();
  };

  function handleStoryScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, storyWidth + theme.spacing.md));
    if (page !== storyPage) setStoryPage(page);
  }

  const helplinePreview = menu ? menu.helplines.slice(0, 3) : [];

  return (
    // `transparent` so the home screen stays visible behind the gutter. Modal (rather than an
    // absolutely-positioned View) so the drawer sits above the tab bar — otherwise the bottom nav
    // floats on top of the panel and stays tappable while the drawer is open.
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { width: panelWidth, paddingTop: insets.top + theme.spacing.md, paddingBottom: insets.bottom },
            panelStyle,
          ]}
        >
          <View style={styles.head}>
            <PressableScale onPress={onClose} scaleTo={0.9} hitSlop={10} accessibilityLabel="Close menu" style={styles.closeBtn}>
              <Feather name="x" size={18} color={theme.color.textSecondary} />
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>

            {/* ---- Success stories -------------------------------------------------------- */}
            {(!menu || menu.stories.length > 0) && (
              <SectionCard
                title="SUCCESS STORIES"
                style={[styles.block, { marginTop: 0 }]}
                onViewAll={menu ? go(() => navigation.navigate("SuccessStories")) : undefined}
              >
                {!menu ? (
                  <BlockSkeleton rows={1} tall error={menuError} onRetry={loadMenu} />
                ) : (
                  <>
                    <ScrollView
                      horizontal
                      pagingEnabled={false}
                      snapToInterval={storyWidth + theme.spacing.md}
                      decelerationRate="fast"
                      showsHorizontalScrollIndicator={false}
                      onScroll={handleStoryScroll}
                      scrollEventThrottle={32}
                      contentContainerStyle={{ gap: theme.spacing.md }}
                    >
                      {menu.stories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          width={storyWidth}
                          onPress={go(() => navigation.navigate("SuccessStory", { storyId: story.id, initial: story }))}
                        />
                      ))}
                    </ScrollView>
                    <Dots count={menu.stories.length} active={storyPage} />
                  </>
                )}
              </SectionCard>
            )}

            {/* ---- Top supporters --------------------------------------------------------- */}
            {(!menu || menu.supporters.length > 0) && (
              <SectionCard
                title="TOP SUPPORTERS"
                style={styles.block}
                onViewAll={menu ? go(() => navigation.navigate("TopSupporters")) : undefined}
              >
                {!menu ? (
                  <BlockSkeleton rows={3} error={menuError} onRetry={loadMenu} />
                ) : (
                  menu.supporters.map((s) => <SupporterRow key={s.id} supporter={s} />)
                )}
              </SectionCard>
            )}

            {/* ---- Upcoming events -------------------------------------------------------- */}
            {(!menu || menu.events.length > 0) && (
              <SectionCard
                title="UPCOMING EVENTS"
                style={styles.block}
                onViewAll={menu ? go(() => navigation.navigate("Events")) : undefined}
              >
                {!menu ? (
                  <BlockSkeleton rows={2} error={menuError} onRetry={loadMenu} />
                ) : (
                  menu.events.map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      onPress={go(() => navigation.navigate("EventDetail", { eventId: e.id, initial: e }))}
                    />
                  ))
                )}
              </SectionCard>
            )}

            {/* ---- Safety & emergency support -------------------------------------------- */}
            <SectionCard
              title="SAFETY & EMERGENCY SUPPORT"
              style={styles.block}
              onViewAll={menu && menu.helplines.length > helplinePreview.length ? go(() => navigation.navigate("Helplines")) : undefined}
              viewAllLabel="View all"
            >
              {!menu ? (
                <BlockSkeleton rows={3} error={menuError} onRetry={loadMenu} />
              ) : helplinePreview.length === 0 ? (
                <Text style={styles.emptyText}>No helplines have been published yet.</Text>
              ) : (
                <>
                  {helplinePreview.map((h) => (
                    <HelplineRow key={h.id} helpline={h} onPress={() => void dial(h.number)} />
                  ))}
                  <PressableScale
                    onPress={go(() => navigation.navigate("Helplines"))}
                    scaleTo={0.98}
                    style={styles.blockButton}
                  >
                    <Text style={styles.blockButtonText}>View all helplines</Text>
                    <Feather name="arrow-right" size={15} color={theme.color.primary} />
                  </PressableScale>
                </>
              )}
            </SectionCard>

            {/* ---- Trust & transparency (static by design) -------------------------------- */}
            <SectionCard title="TRUST & TRANSPARENCY" style={styles.block}>
              <TrustPoints />
            </SectionCard>

            {/* ---- Make an impact today --------------------------------------------------- */}
            <ImpactCta onPress={go(() => navigation.navigate("CreateNeedChooser"))} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Placeholder rows while the menu loads — or the retry, if it failed.
 *
 * One component for both states because they occupy the same slot: showing a skeleton forever
 * after a failed request is the worst outcome, and it is exactly what happens when the error
 * path is left to a separate branch someone forgets to render.
 */
function BlockSkeleton({
  rows,
  tall,
  error,
  onRetry,
}: {
  rows: number;
  tall?: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <PressableScale onPress={onRetry} scaleTo={0.98} style={styles.retry}>
        <Feather name="refresh-cw" size={14} color={theme.color.primary} />
        <Text style={styles.retryText}>{error} — tap to retry</Text>
      </PressableScale>
    );
  }
  return (
    <View style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <Skeleton width={tall ? 84 : 34} height={tall ? 96 : 34} radius={tall ? theme.radii.md : 17} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="70%" height={13} />
            <Skeleton width="45%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(24, 10, 12, 0.42)",
  },
  panel: {
    height: "100%",
    backgroundColor: theme.color.background,
    borderTopLeftRadius: theme.radii.xxl,
    borderBottomLeftRadius: theme.radii.xxl,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.xs },

  block: { marginTop: theme.spacing.md },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.primarySoft,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  blockButtonText: { ...theme.typography.bodySmall, fontWeight: "700", color: theme.color.primary },
  emptyText: {
    ...theme.typography.caption,
    color: theme.color.textSecondary,
    paddingVertical: theme.spacing.md,
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  retryText: { ...theme.typography.caption, color: theme.color.primary, flex: 1 },
});
