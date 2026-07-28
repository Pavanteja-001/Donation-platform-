import type { Need } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { computeEligibility } from "./bloodEligibility";
import { parseBloodPayload } from "./bloodNeed";
import { NotificationType } from "@prisma/client";
import { notify } from "./notifications";

// PRD §8.4 — a one-time push to every eligible donor when a BLOOD need goes LIVE.
export async function notifyEligibleBloodDonors(need: Need): Promise<{ notified: number }> {
  const blood = parseBloodPayload(need.payload);
  if (!blood || !need.city) return { notified: 0 };

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

  console.log(`[blood-match] Found ${candidates.length} candidate donors in ${need.city} for ${blood.blood_group}`);

  const eligible = candidates.filter((c) => computeEligibility(c).eligible);
  if (eligible.length === 0) {
    console.log("[blood-match] No eligible donors matched push criteria.");
    return { notified: 0 };
  }

  // Routed through `notify` so each matched donor also gets an inbox row — a blood alert that
  // failed to deliver (dead token, silenced channel) is the exact case where the donor most
  // needs to still find it in the app.
  await notify({
    recipientIds: eligible.map((d) => d.id),
    type: NotificationType.BLOOD_REQUEST,
    title: need.urgency === "EMERGENCY" ? "🚨 Emergency blood request nearby" : "Blood request nearby",
    body: `${need.title} — ${blood.blood_group.replace("_", " ")} needed in ${need.area ?? need.city}`,
    needId: need.id,
    urgent: need.urgency === "EMERGENCY",
  });

  return { notified: eligible.length };
}
