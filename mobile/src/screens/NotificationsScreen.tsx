import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import {
  clearAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { timeAgo } from "../lib/needMeta";
import { IconPlate, litRamp } from "../components/Depth";
import { Gradient } from "../components/Gradient";
import { Button, EmptyState, ErrorState, PressableScale, Skeleton } from "../components/ui";
import type { IconName } from "../lib/needMeta";

/**
 * Icon + colour per notification type.
 *
 * A blood request must be identifiable at a glance in a list that also holds forum replies and
 * admin queue items — the icon is doing real triage work here, not decoration.
 */
const TYPE_META: Record<NotificationType, { icon: IconName; color: string; label: string }> = {
  BLOOD_REQUEST: { icon: "droplet", color: theme.color.blood, label: "Blood request" },
  CONTRIBUTION_RECEIVED: { icon: "gift", color: theme.color.primary, label: "New response" },
  CONTRIBUTION_CONFIRMED: { icon: "check-circle", color: theme.color.success, label: "Confirmed" },
  NEED_STATUS: { icon: "activity", color: theme.color.info, label: "Status update" },
  FORUM_ANSWER: { icon: "message-circle", color: theme.color.accent, label: "Community" },
  VERIFICATION_QUEUE: { icon: "shield", color: theme.color.warning, label: "Verification" },
};

function NotificationRow({
  item,
  onPress,
  onDelete,
}: {
  item: AppNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.NEED_STATUS;
  const isUnread = item.readAt === null;

  return (
    <PressableScale onPress={onPress} scaleTo={0.99} style={[styles.row, isUnread && styles.rowUnread]}>
      {isUnread && (
        <Gradient
          colors={theme.gradient.surfaceSheen}
          direction="diagonal"
          style={StyleSheet.absoluteFill as never}
          pointerEvents="none"
        />
      )}
      <IconPlate icon={meta.icon} size="md" tone="custom" colors={litRamp(meta.color)} />

      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {/* An unread dot rather than bold-everything: the list stays scannable when most rows
              are unread, which is the normal state after a burst of blood alerts. */}
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.rowText} numberOfLines={2}>
          {item.body}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowType, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>

      <PressableScale onPress={onDelete} scaleTo={0.9} hitSlop={10} accessibilityLabel="Delete notification" style={styles.deleteBtn}>
        <Feather name="x" size={16} color={theme.color.textTertiary} />
      </PressableScale>
    </PressableScale>
  );
}

export function NotificationsScreen({ onOpenNeed }: { onOpenNeed?: (needId: string) => void }) {
  const { token } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { notifications, unreadCount } = await fetchNotifications(token);
      setItems(notifications);
      setUnread(unreadCount);
      setError(null);
    } catch (err) {
      if (!items) setError(err instanceof Error ? err.message : "Couldn't load notifications");
    }
    // `items` is deliberately out of the dep list — including it would rebuild `load` on every
    // fetch and re-trigger the focus effect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleOpen(item: AppNotification) {
    if (token && item.readAt === null) {
      // Optimistic: the row should stop looking unread the instant it's tapped.
      setItems((prev) => (prev ? prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)) : prev));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(token, item.id).catch(() => {});
    }
    if (item.needId && onOpenNeed) onOpenNeed(item.needId);
  }

  async function handleDelete(id: string) {
    if (!token) return;
    const previous = items;
    setItems((prev) => (prev ? prev.filter((n) => n.id !== id) : prev));
    try {
      await deleteNotification(token, id);
    } catch {
      // Put it back rather than silently losing the row from the list while it still exists.
      setItems(previous ?? null);
    }
  }

  function handleClearAll() {
    if (!token || !items || items.length === 0) return;
    Alert.alert("Clear all notifications?", "This removes every notification from your inbox. It can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: async () => {
          const previous = items;
          setItems([]);
          setUnread(0);
          try {
            await clearAllNotifications(token);
          } catch {
            setItems(previous);
          }
        },
      },
    ]);
  }

  async function handleMarkAllRead() {
    if (!token) return;
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev));
    setUnread(0);
    markAllNotificationsRead(token).catch(() => {});
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  if (error && !items) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!items) {
    return (
      <View style={[styles.screen, styles.listContent]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.row, { gap: theme.spacing.md }]}>
            <Skeleton width={44} height={44} radius={theme.radii.md} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={15} />
              <Skeleton width="90%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {items.length > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.toolbarText}>
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </Text>
          <View style={styles.toolbarActions}>
            {unread > 0 && <Button label="Mark all read" variant="ghost" size="sm" onPress={handleMarkAllRead} />}
            <Button label="Clear all" icon="trash-2" variant="ghost" size="sm" onPress={handleClearAll} />
          </View>
        </View>
      )}

      {items.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="bell"
            title="No notifications yet"
            subtitle="Blood requests matching your profile, responses to your posts and confirmations will appear here."
          />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(theme.motion.normal)} style={{ flex: 1 }}>
          <FlashList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationRow item={item} onPress={() => handleOpen(item)} onDelete={() => handleDelete(item.id)} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  toolbarText: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "700" },
  toolbarActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    overflow: "hidden",
    ...theme.elevation.level1,
  },
  rowUnread: { borderColor: "rgba(185, 28, 28, 0.22)" },
  rowBody: { flex: 1, gap: 3 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  rowTitle: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, flexShrink: 1 },
  rowTitleUnread: { fontWeight: "800" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.primary },
  rowText: { ...theme.typography.caption, color: theme.color.textSecondary, lineHeight: 17 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: 2 },
  rowType: { ...theme.typography.overline, fontWeight: "800" },
  rowTime: { ...theme.typography.caption, color: theme.color.textTertiary },
  deleteBtn: { padding: 4 },
});
