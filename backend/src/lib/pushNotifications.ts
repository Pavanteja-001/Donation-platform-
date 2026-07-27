import { prisma } from "./prisma";

// D-016 — Expo push. No FCM/APNs credentials needed directly: Expo's push service is the
// single HTTP API for both, and takes an Expo push token (not a raw device token).
//
// It does still need the *project's* FCM credentials uploaded to Expo, and the app must be able
// to mint a real token (which needs `extra.eas.projectId`) — without both, every send here is
// rejected per-message with DeviceNotRegistered.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  // Emergency uses Expo's "high" priority (D-016 — heads-up + sound) so it stands out;
  // everything else uses the default.
  priority?: "default" | "high";
  // ANDROID ONLY, and required for sound to play at all.
  //
  // From Android 8 the notification *channel* owns sound, vibration and heads-up behaviour —
  // the `sound: "default"` field below is honoured on iOS but ignored on Android. Omitting
  // channelId meant every push landed on a fallback channel instead of the "default"/
  // "emergency" channels the app configures at login, so they arrived silently.
  //
  // Must match a channel id created in mobile/src/lib/pushNotifications.ts.
  channelId?: "default" | "emergency";
  data?: Record<string, unknown>;
}

// One entry per message, same order as the request.
interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string; expoPushToken?: string };
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
          channelId: m.channelId ?? "default",
          data: m.data,
        }))
      ),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[push] Expo push API returned ${res.status}`);
      return;
    }

    // Expo answers **200 OK even when every message failed** — the per-message verdict lives in
    // the response body, one ticket per message. Checking only `res.ok` (what this used to do)
    // meant an invalid/stale token produced complete silence: no notification, no log, nothing
    // to debug. Read the tickets.
    const body = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
    const tickets = body?.data ?? [];
    const failed = tickets
      .map((ticket, i) => ({ ticket, token: messages[i]?.to }))
      .filter(({ ticket }) => ticket.status === "error");

    if (failed.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `[push] ${failed.length}/${messages.length} rejected by Expo:`,
        failed.map(({ ticket, token }) => `${token} → ${ticket.details?.error ?? "?"}: ${ticket.message ?? ""}`)
      );
    }

    // DeviceNotRegistered means the token is dead (app uninstalled, credentials changed, or it
    // was never a real token). Expo asks senders to stop using it — and keeping it makes the
    // donor look reachable when they aren't, which is what hid this failure in the first place.
    const dead = failed
      .filter(({ ticket }) => ticket.details?.error === "DeviceNotRegistered")
      .map(({ token }) => token)
      .filter((t): t is string => !!t);

    if (dead.length > 0) {
      const cleared = await prisma.user.updateMany({
        where: { expoPushToken: { in: dead } },
        data: { expoPushToken: null },
      });
      // eslint-disable-next-line no-console
      console.warn(`[push] Cleared ${cleared.count} dead push token(s); those users must re-register.`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[push] Failed to send push notifications:", err);
  }
}
