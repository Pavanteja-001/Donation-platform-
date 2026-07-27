import type { Need } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { computeEligibility } from "./bloodEligibility";
import { parseBloodPayload } from "./bloodNeed";
import { sendPushNotifications } from "./pushNotifications";

// PRD §8.4 — a one-time push to every eligible donor when a BLOOD need goes LIVE. Not a live
// subscription; re-notifying on later changes (e.g. urgency escalation) is a v2 concern.
export async function notifyEligibleBloodDonors(need: Need): Promise<{ notified: number }> {
  const blood = parseBloodPayload(need.payload);
  if (!blood || !need.city) return { notified: 0 };

  // Coarse DB-level filter (blood group + district/city/area matching + has a push token + hasn't opted out)
  const locationTerms = [need.city, need.area].filter((s): s is string => !!s && s.trim().length > 0);

  const candidates = await prisma.user.findMany({
    where: {
      role: Role.USER,
      bloodGroup: blood.blood_group,
      availableToDonate: true,
      expoPushToken: { not: null },
      OR: [
        { city: { in: locationTerms, mode: "insensitive" } },
        { area: { in: locationTerms, mode: "insensitive" } },
      ],
    },
  });

  const eligible = candidates.filter((c) => computeEligibility(c).eligible);
  if (eligible.length === 0) return { notified: 0 };

  await sendPushNotifications(
    eligible.map((donor) => ({
      to: donor.expoPushToken!,
      title: need.urgency === "EMERGENCY" ? "🚨 Emergency blood request nearby" : "Blood request nearby",
      body: `${need.title} — ${blood.blood_group.replace("_", " ")} needed in ${need.area ?? need.city}`,
      priority: need.urgency === "EMERGENCY" ? "high" : "default",
      data: { needId: need.id },
    }))
  );

  return { notified: eligible.length };
}
