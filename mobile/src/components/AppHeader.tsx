import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { fetchUnreadCount } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { AppNavigationProp } from "../navigation/types";
import { theme } from "../lib/theme";
import { PressableScale } from "./ui";

/**
 * The app bar on the home screen: brand, then the three things a signed-in user reaches for.
 *
 * This exists because the notification bell used to live inside the crimson FeedHero, which was
 * the ONLY route to the Notifications screen in the entire app. Anything that replaced the hero
 * would have silently orphaned the inbox — so the bell belongs in durable furniture, not inside
 * a content block that a redesign can delete.
 */

const LOGO = require("../../assets/logo-full.webp");

function NotificationBell() {
  const { token } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const [unread, setUnread] = useState(0);

  // Refetched on focus rather than polled: the count only changes while the user is elsewhere in
  // the app (or the app is backgrounded), so a timer would spend battery to learn nothing.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchUnreadCount(token)
        .then(({ unreadCount }) => setUnread(unreadCount))
        .catch(() => {
          // A failed count must not blank the bell — the inbox is still reachable, we just
          // don't know the number.
        });
    }, [token])
  );

  return (
    <View>
      <HeaderButton
        icon="bell"
        onPress={() => navigation.navigate("Notifications")}
        label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      />
      {unread > 0 && (
        // pointerEvents none so the badge can overlap the tap target without stealing the tap.
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </View>
  );
}

function HeaderButton({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.9} hitSlop={8} accessibilityLabel={label} style={styles.button}>
      <Feather name={icon} size={19} color={theme.color.primary} />
    </PressableScale>
  );
}

export function AppHeader({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    // Top inset applied here rather than with SafeAreaView so the header's background colour
    // extends behind the status bar instead of leaving a bare strip above it.
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
      <Image source={LOGO} style={styles.logo} contentFit="contain" transition={120} />

      <View style={styles.actions}>
        {/* The design also calls for a search button here. It is deliberately absent until search
            actually exists: an icon that silently does nothing (or worse, opens an unrelated
            screen) teaches people the app is broken, which costs more than the missing feature. */}
        <NotificationBell />
        <HeaderButton icon="menu" onPress={onOpenDrawer} label="Open menu" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.color.background,
  },
  // Width-constrained, height-derived: the wordmark is ~1.8:1, and fixing both dimensions would
  // squash it on any device where the ratio rounds differently.
  logo: { width: 132, height: 34 },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.color.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.color.background,
  },
  badgeText: { color: theme.color.textInverse, fontSize: 10, fontWeight: "800" },
});
