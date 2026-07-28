import type { Need } from "@prisma/client";
import { ContributionKind } from "@prisma/client";
import { prisma } from "./prisma";
import { parseBloodPayload } from "./bloodNeed";
import { sendPushNotifications } from "./pushNotifications";

/**
 * Tells the person who posted a need that someone has stepped forward.
 *
 * This closes the loop that was missing: a donor tapping "I can donate" created a
 * PENDING_CONFIRMATION contribution that only appeared if the beneficiary happened to reopen the
 * app. For BLOOD that's the difference between a donor being called within a minute and a
 * request going stale — the whole point of the module is speed.
 *
 * PRIVACY: the notification deliberately carries **no donor name or phone number**. Push
 * notifications render on a lock screen, in front of whoever is holding the phone, and blood
 * group + contact details are sensitive health data (CLAUDE.md §7). The alert says only that
 * someone responded; the beneficiary opens the need to see who, inside the authenticated app.
 *
 * Best-effort throughout: a failed push must never fail the donation that triggered it.
 */
export async function notifyPosterOfContribution(
  need: Pick<Need, "id" | "title" | "type" | "postedById" | "payload">,
  kind: ContributionKind
): Promise<void> {
  const poster = await prisma.user.findUnique({
    where: { id: need.postedById },
    select: { expoPushToken: true },
  });
  if (!poster?.expoPushToken) return;

  const blood = need.type === "BLOOD" ? parseBloodPayload(need.payload) : null;
  const group = blood ? blood.blood_group.replace("_POSITIVE", "+").replace("_NEGATIVE", "-") : null;

  const { title, body } = messageFor(kind, need.title, group);

  await sendPushNotifications([
    {
      to: poster.expoPushToken,
      title,
      body,
      // A blood responder is time-critical — the beneficiary is expected to call them back, so
      // it goes to the high-priority channel like an emergency alert. Everything else is a
      // normal-priority "come and confirm this when you can".
      priority: kind === ContributionKind.BLOOD ? "high" : "default",
      channelId: kind === ContributionKind.BLOOD ? "emergency" : "default",
      // Deep-links to the need, where the donor's details and the confirm button live.
      data: { needId: need.id },
    },
  ]);
}

function messageFor(kind: ContributionKind, needTitle: string, bloodGroup: string | null) {
  switch (kind) {
    case ContributionKind.BLOOD:
      return {
        title: "🩸 A donor can give blood",
        body: `Someone has offered ${bloodGroup ? bloodGroup + " " : ""}blood for "${needTitle}". Open the app to see their details and call them.`,
      };
    case ContributionKind.MONEY:
      return {
        title: "A donation has arrived",
        body: `Someone contributed to "${needTitle}". Check the payment and confirm it once received.`,
      };
    case ContributionKind.KIT:
      return {
        title: "Someone is funding your kits",
        body: `A donor has pledged kits for "${needTitle}". Open the app to confirm.`,
      };
    case ContributionKind.MEAL_SLOT:
      return {
        title: "A meal slot was booked",
        body: `Someone booked a date on "${needTitle}". Open the app to confirm.`,
      };
    case ContributionKind.GOODS:
      return {
        title: "Someone claimed your item",
        body: `A person has claimed "${needTitle}". Open the app to arrange handover.`,
      };
    default:
      return {
        title: "Someone responded to your post",
        body: `There's a new response on "${needTitle}". Open the app to see it.`,
      };
  }
}
