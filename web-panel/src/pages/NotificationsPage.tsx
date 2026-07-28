import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { EmptyState, ErrorState } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

/**
 * Icon + tone per notification type — the same triage cue the mobile inbox uses, so a blood
 * request is identifiable at a glance in a list that also holds queue items and confirmations.
 */
const TYPE_META: Record<NotificationType, { icon: string; label: string; tone: string }> = {
  BLOOD_REQUEST: { icon: "🩸", label: "Blood request", tone: "var(--color-danger)" },
  CONTRIBUTION_RECEIVED: { icon: "🎁", label: "New response", tone: "var(--color-primary)" },
  CONTRIBUTION_CONFIRMED: { icon: "✅", label: "Confirmed", tone: "var(--color-success)" },
  NEED_STATUS: { icon: "🔄", label: "Status update", tone: "var(--color-info)" },
  FORUM_ANSWER: { icon: "💬", label: "Community", tone: "var(--color-accent)" },
  VERIFICATION_QUEUE: { icon: "🛡️", label: "Verification queue", tone: "var(--color-warning)" },
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setError(null);
    fetchNotifications(token)
      .then(({ notifications, unreadCount }) => {
        setItems(notifications);
        setUnread(unreadCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notifications"));
  }

  useEffect(load, [token]);

  function handleOpen(item: AppNotification) {
    if (token && item.readAt === null) {
      // Optimistic — the row should stop looking unread the moment it's clicked.
      setItems((prev) => (prev ? prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)) : prev));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(token, item.id).catch(() => {});
    }
    if (item.needId) navigate(`/needs/${item.needId}`);
  }

  async function handleDelete(id: string) {
    if (!token) return;
    const previous = items;
    setItems((prev) => (prev ? prev.filter((n) => n.id !== id) : prev));
    try {
      await deleteNotification(token, id);
    } catch {
      setItems(previous ?? null);
    }
  }

  async function handleClearAll() {
    if (!token || !items?.length) return;
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    const previous = items;
    setItems([]);
    setUnread(0);
    try {
      await clearAllNotifications(token);
    } catch {
      setItems(previous);
    }
  }

  async function handleMarkAllRead() {
    if (!token) return;
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev));
    setUnread(0);
    markAllNotificationsRead(token).catch(() => {});
  }

  return (
    <div>
      <h2>Notifications</h2>
      <p className="hint">
        Every alert your organisation has received. This panel has no push notifications, so this
        list is where responses to your requests arrive.
      </p>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !items && <PageSkeleton />}

      {items && items.length > 0 && (
        <div className="row-actions" style={{ margin: "16px 0", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-secondary)" }}>
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            {unread > 0 && (
              <button type="button" className="btn-action-secondary" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
            <button type="button" className="btn-action-danger" onClick={handleClearAll}>
              Clear all
            </button>
          </span>
        </div>
      )}

      {items && items.length === 0 && (
        <EmptyState
          title="No notifications yet"
          subtitle="Donor responses, confirmations and status updates on your requests will appear here."
        />
      )}

      {items && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.NEED_STATUS;
            const isUnread = n.readAt === null;
            return (
              <div
                key={n.id}
                className="card"
                onClick={() => handleOpen(n)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: 16,
                  cursor: n.needId ? "pointer" : "default",
                  borderColor: isUnread ? "rgba(185, 28, 28, 0.24)" : undefined,
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1.2 }}>{meta.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontWeight: isUnread ? 800 : 600 }}>{n.title}</strong>
                    {isUnread && (
                      <span
                        aria-label="unread"
                        style={{ width: 8, height: 8, borderRadius: 4, background: "var(--color-primary)" }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 2 }}>{n.body}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 12 }}>
                    <span style={{ color: meta.tone, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {meta.label}
                    </span>
                    <span style={{ color: "var(--color-text-tertiary)" }}>{timeAgo(n.createdAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="link"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n.id);
                  }}
                  style={{ color: "var(--color-text-tertiary)", fontSize: 16, lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
