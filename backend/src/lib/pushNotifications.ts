// D-016 — Expo push. No FCM/APNs credentials needed directly: Expo's push service is the
// single HTTP API for both, and takes an Expo push token (not a raw device token).
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  // Emergency uses Expo's "high" priority (D-016 — heads-up + sound) so it stands out;
  // everything else uses the default.
  priority?: "default" | "high";
  data?: Record<string, unknown>;
}

// Best-effort — a failed push must never block the need-verification request that triggered it.
// Logs and swallows errors rather than throwing.
export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        messages.map((m) => ({
          to: m.to,
          title: m.title,
          body: m.body,
          sound: "default",
          priority: m.priority === "high" ? "high" : "default",
          data: m.data,
        }))
      ),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[push] Expo push API returned ${res.status}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[push] Failed to send push notifications:", err);
  }
}
