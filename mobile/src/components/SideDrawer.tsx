import { useEffect } from "react";
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import type { AppNavigationProp } from "../navigation/types";
import { theme } from "../lib/theme";
import { PressableScale, Button } from "./ui";

/**
 * The right-edge drawer.
 *
 * Covers 75% of the width, never the full screen: the strip of home screen still visible on the
 * left is what tells you this is a panel over the page rather than a new page you navigated to —
 * so tapping outside to dismiss is discoverable instead of something you have to guess.
 */
const WIDTH_FRACTION = 0.75;

interface DrawerLink {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}

export function SideDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AppNavigationProp>();
  const panelWidth = width * WIDTH_FRACTION;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      // Slightly faster out than in: a panel that lingers on dismissal reads as unresponsive,
      // while an entrance that rushes reads as jarring.
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

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

  const links: DrawerLink[] = [
    {
      icon: "home",
      label: "Orphanages & homes",
      hint: "Sponsor a meal slot",
      onPress: go(() => navigation.navigate("Orphanages")),
    },
    { icon: "briefcase", label: "NGOs", hint: "Verified organisations", onPress: go(() => navigation.navigate("Ngos")) },
    { icon: "package", label: "Donate items", hint: "Give or request goods", onPress: go(() => navigation.navigate("Goods")) },
    { icon: "message-circle", label: "Community", hint: "Ask and answer", onPress: go(() => navigation.navigate("Forum")) },
  ];

  return (
    // `transparent` so the home screen stays visible behind the 25% gutter. Modal (rather than an
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
            <Text style={styles.headTitle}>Menu</Text>
            <PressableScale onPress={onClose} scaleTo={0.9} hitSlop={10} accessibilityLabel="Close menu" style={styles.closeBtn}>
              <Feather name="x" size={18} color={theme.color.textSecondary} />
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* Posting a need is the drawer's reason to exist for a beneficiary, so it leads —
                above the browse links, which are what a donor came for. */}
            <Button
              label="Post a need"
              icon="plus"
              onPress={go(() => navigation.navigate("CreateNeedChooser"))}
              style={styles.cta}
            />

            <Text style={styles.sectionLabel}>EXPLORE</Text>
            {links.map((l) => (
              <PressableScale key={l.label} onPress={l.onPress} scaleTo={0.98} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Feather name={l.icon} size={17} color={theme.color.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{l.label}</Text>
                  {l.hint ? <Text style={styles.rowHint}>{l.hint}</Text> : null}
                </View>
                <Feather name="chevron-right" size={17} color={theme.color.textTertiary} />
              </PressableScale>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radii.xxl,
    borderBottomLeftRadius: theme.radii.xxl,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headTitle: { ...theme.typography.h2, color: theme.color.textPrimary },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: theme.spacing.xs },
  cta: { marginBottom: theme.spacing.lg },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: theme.color.textTertiary,
    marginBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { ...theme.typography.bodyMedium, color: theme.color.textPrimary },
  rowHint: { ...theme.typography.caption, color: theme.color.textSecondary },
});
