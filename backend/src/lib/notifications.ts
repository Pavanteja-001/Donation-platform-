import { NotificationType, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { sendPushNotifications, type PushMessage } from "./pushNotifications";

/**
 * The single way this platform notifies anyone.
 *
 * Persist first, push second — and push is best-effort. Every delivery failure this project has
 * already hit (dead token, channel silenced, system tone set to None, phone offline) leaves the
 * stored row untouched, so the user still finds the alert in their inbox. Push is the tap on the
 * shoulder; the row is the message.
 *
 * Recipients without a push token still get a row. That's the point: an institution using only
 * the web panel has no token at all, and would otherwise be told nothing.
 */
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
    select: { id: true, expoPushToken: true },
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
    .filter((r) => !!r.expoPushToken)
    .map((r) => ({
      to: r.expoPushToken!,
      title: input.title,
      body: input.body,
      priority: input.urgent ? "high" : "default",
      channelId: input.urgent ? "emergency" : "default",
      data: { needId: input.needId, forumId: input.forumId },
    }));

  // Deliberately not awaited by callers' critical paths — see each call site.
  await sendPushNotifications(messages);

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
