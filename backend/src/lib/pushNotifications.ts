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

/**
 * Expo rejects a /send request carrying more than 100 messages — the whole request, not the
 * excess. Sending the full array in one POST therefore failed *silently and completely* at
 * exactly the moment this platform matters most: a city-wide emergency blood alert is the one
 * push that routinely matches more than 100 donors, so the larger the emergency, the more
 * certain it was that nobody heard about it. Anything under the limit worked fine, which is why
 * it survived testing.
 */
const EXPO_PUSH_BATCH_SIZE = 100;

/**
 * Sends one ≤100-message batch and returns the tokens Expo reported as dead.
 *
 * Swallows its own errors on purpose: one rejected batch must not abort the batches after it.
 * Half the donors in a city hearing about an emergency beats none of them.
 */
async function sendBatch(batch: PushMessage[], batchLabel: string): Promise<string[]> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(

        batch.map((m) => ({
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
      console.error(`[push] ${batchLabel}: Expo push API returned ${res.status}`);
      return [];
    }

    // Expo answers **200 OK even when every message failed** — the per-message verdict lives in
    // the response body, one ticket per message. Checking only `res.ok` (what this used to do)
    // meant an invalid/stale token produced complete silence: no notification, no log, nothing
    // to debug. Read the tickets.
    const body = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
    const tickets = body?.data ?? [];
    const failed = tickets
      .map((ticket, i) => ({ ticket, token: batch[i]?.to }))
      .filter(({ ticket }) => ticket.status === "error");

    if (failed.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `[push] ${batchLabel}: ${failed.length}/${batch.length} rejected by Expo:`,
        failed.map(({ ticket, token }) => `${token} → ${ticket.details?.error ?? "?"}: ${ticket.message ?? ""}`)
      );
    }

    // DeviceNotRegistered means the token is dead (app uninstalled, credentials changed, or it
    // was never a real token). Expo asks senders to stop using it — and keeping it makes the
    // donor look reachable when they aren't, which is what hid this failure in the first place.
    return failed
      .filter(({ ticket }) => ticket.details?.error === "DeviceNotRegistered")
      .map(({ token }) => token)
      .filter((t): t is string => !!t);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[push] ${batchLabel}: failed to send:`, err);
    return [];
  }
}

// Best-effort — a failed push must never block the need-verification request that triggered it.
// Logs and swallows errors rather than throwing.
export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const batchCount = Math.ceil(messages.length / EXPO_PUSH_BATCH_SIZE);
  const dead: string[] = [];

  // Sequential, not Promise.all. Expo rate-limits a project's sends, and the fan-out that needs
  // batching at all is precisely the one large enough to trip that limit — firing 50 requests at
  // once to save a few seconds would trade a size failure for a rate failure. Nothing awaits this
  // function on a request path (see call sites), so the wall-clock cost is invisible to users.
  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
    const batchNumber = Math.floor(i / EXPO_PUSH_BATCH_SIZE) + 1;
    const batch = messages.slice(i, i + EXPO_PUSH_BATCH_SIZE);
    dead.push(...(await sendBatch(batch, `batch ${batchNumber}/${batchCount}`)));
  }

  // Cleared once across every batch rather than per batch — the same dead token can only appear
  // once anyway, and this keeps the fan-out to a single write no matter how many batches ran.
  if (dead.length > 0) {
    const cleared = await prisma.user.updateMany({
      where: { expoPushToken: { in: dead } },
      data: { expoPushToken: null },
    });
    // eslint-disable-next-line no-console
    console.warn(`[push] Cleared ${cleared.count} dead push token(s); those users must re-register.`);
  }
}
