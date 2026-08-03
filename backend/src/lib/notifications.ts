import { NotificationType, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { sendPushNotifications, type PushMessage } from "./pushNotifications";

export interface NotifyInput {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  needId?: string;
  forumId?: string;
  /** Android channel + priority. Emergency blood alerts use the heartbeat channel. */
  urgent?: boolean;
}

export async function notify(input: NotifyInput): Promise<{ stored: number; pushed: number }> {
  const recipientIds = [...new Set(input.recipientIds)].filter(Boolean);
  if (recipientIds.length === 0) return { stored: 0, pushed: 0 };

  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, fcmToken: true, expoPushToken: true },
  });
  if (recipients.length === 0) return { stored: 0, pushed: 0 };

  const stored = await prisma.notification.createMany({
    data: recipients.map((r) => ({
      recipientId: r.id,
      type: input.type,
      title: input.title,
      body: input.body,
      needId: input.needId ?? null,
      forumId: input.forumId ?? null,
    })),
  });

  const messages: PushMessage[] = recipients
    .map((r): PushMessage | null => {
      const token = r.fcmToken ?? r.expoPushToken;
      if (!token) return null;
      return {
        to: token,
        title: input.title,
        body: input.body,
        priority: input.urgent ? "high" : "default",
        channelId: input.urgent ? "emergency" : "default",
        data: { needId: input.needId, forumId: input.forumId },
      };
    })
    .filter((m): m is PushMessage => m !== null);

  // Non-blocking async dispatch for maximum performance
  if (messages.length > 0) {
    setImmediate(() => {
      sendPushNotifications(messages).catch((err) => {
        console.error("[notify] Error dispatching push notifications:", err);
      });
    });
  }

  return { stored: stored.count, pushed: messages.length };
}

/**
 * Everyone who staffs the verification queue. Used when a need is submitted, so a request isn't
 * sitting unseen because nobody happened to open the console.
 */
export async function notifyVerificationQueue(need: {
  id: string;
  title: string;
  type: string;
  city: string | null;
}): Promise<void> {
  const staff = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.STAFF] } },
    select: { id: true },
  });

  await notify({
    recipientIds: staff.map((s) => s.id),
    type: NotificationType.VERIFICATION_QUEUE,
    title: "New request awaiting verification",
    body: `${need.type} — "${need.title}"${need.city ? ` in ${need.city}` : ""} is in the queue.`,
    needId: need.id,
  });
}
