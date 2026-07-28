import { Router } from "express";
import { NeedStatus, NeedType, Prisma } from "@prisma/client";
import type { Need } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { invalidateNeedCaches } from "../lib/cache";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { parseMoneyPayload } from "../lib/moneyNeed";
import { parseKitPayload } from "../lib/kitNeed";
import { parseBloodPayload } from "../lib/bloodNeed";
import { parseMealSlotPayload } from "../lib/mealSlotNeed";
import { parseGoodsPayload } from "../lib/goodsNeed";
import { CERTIFICATE_DISCLAIMER, summarizeContribution } from "../lib/contributionSummary";
import { NotificationType } from "@prisma/client";
import { notify } from "../lib/notifications";

const router = Router();
router.use(requireAuth);

// PRD §14.3 — every contribution the caller has made, across every need, most recent first.
// The first contributions query from the donor's own side rather than the beneficiary's — every
// prior GET /:id/contributions only worked for the need's owner or admin/staff.
router.get("/mine", async (req, res) => {
  const contributions = await prisma.contribution.findMany({
    where: { donorId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    include: { need: { select: { id: true, title: true, type: true } } },
  });
  res.json({ contributions });
});

// PRD §14.2 — a certificate is a derived view over a CONFIRMED contribution, not a stored
// record. Only that contribution's donor, or admin/staff, can view it.
router.get("/:id/certificate", async (req, res) => {
  const contribution = await prisma.contribution.findUnique({
    where: { id: req.params.id },
    include: { need: { select: { title: true, type: true } }, donor: { select: { name: true, phone: true } } },
  });
  if (!contribution) return res.status(404).json({ error: "Contribution not found" });
  const isDonor = contribution.donorId === req.user!.sub;
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  if (!isDonor && !isAdminOrStaff) {
    return res.status(403).json({ error: "Not allowed to view this certificate" });
  }
  if (contribution.status !== "CONFIRMED") {
    return res.status(409).json({ error: "This contribution hasn't been confirmed yet" });
  }
  res.json({
    certificate: {
      certificateId: contribution.id,
      donorName: contribution.donor.name ?? contribution.donor.phone,
      needTitle: contribution.need.title,
      needType: contribution.need.type,
      summary: summarizeContribution(contribution),
      confirmedAt: contribution.updatedAt,
      disclaimer: CERTIFICATE_DISCLAIMER,
    },
  });
});

async function loadPendingWithNeed(contributionId: string) {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: { need: true },
  });
  if (!contribution) return null;
  return contribution;
}

// D-002 / D-018: the beneficiary (need.postedBy) confirms/rejects their own need's
// contributions by default; ADMIN can override on any need. STAFF cannot do either —
// "override confirmed donations" is explicitly admin-only.
function canDecide(need: { postedById: string }, userId: string, role: string): boolean {
  return need.postedById === userId || role === "ADMIN";
}

// PRD §7.3/§9.3 — on confirm, the Need's progress field (raised_amount or kits_funded) advances
// by this contribution's amount, clamped to the target (avoids >100% display, D-013), and the
// Need moves LIVE -> PARTIALLY_FULFILLED -> FULFILLED as it crosses the target. Same shared
// pattern for both types; only which field/unit differs.
type FulfilmentResult =
  | { ok: true; status: NeedStatus; payload: Prisma.InputJsonValue }
  | { ok: false; error: string };

function computeFulfilment(need: Need, contributionAmountOrKits: number): FulfilmentResult {
  if (need.type === NeedType.MONEY) {
    const money = parseMoneyPayload(need.payload);
    if (!money) return { ok: false, error: "This need's MONEY payload is malformed — cannot confirm" };
    const raisedAmount = Math.min(money.raised_amount + contributionAmountOrKits, money.target_amount);
    const status =
      raisedAmount >= money.target_amount
        ? NeedStatus.FULFILLED
        : raisedAmount > 0
          ? NeedStatus.PARTIALLY_FULFILLED
          : need.status;
    return { ok: true, status, payload: { ...money, raised_amount: raisedAmount } as Prisma.InputJsonValue };
  }
  if (need.type === NeedType.KIT) {
    const kit = parseKitPayload(need.payload);
    if (!kit) return { ok: false, error: "This need's KIT payload is malformed — cannot confirm" };
    const kitsFunded = Math.min(kit.kits_funded + contributionAmountOrKits, kit.kits_needed);
    const status =
      kitsFunded >= kit.kits_needed
        ? NeedStatus.FULFILLED
        : kitsFunded > 0
          ? NeedStatus.PARTIALLY_FULFILLED
          : need.status;
    return { ok: true, status, payload: { ...kit, kits_funded: kitsFunded } as Prisma.InputJsonValue };
  }
  if (need.type === NeedType.BLOOD) {
    const blood = parseBloodPayload(need.payload);
    if (!blood) return { ok: false, error: "This need's BLOOD payload is malformed — cannot confirm" };
    const unitsFulfilled = Math.min(blood.units_fulfilled + contributionAmountOrKits, blood.units_needed);
    const status =
      unitsFulfilled >= blood.units_needed
        ? NeedStatus.FULFILLED
        : unitsFulfilled > 0
          ? NeedStatus.PARTIALLY_FULFILLED
          : need.status;
    return { ok: true, status, payload: { ...blood, units_fulfilled: unitsFulfilled } as Prisma.InputJsonValue };
  }
  if (need.type === NeedType.MEAL_SLOT) {
    const mealSlot = parseMealSlotPayload(need.payload);
    if (!mealSlot) return { ok: false, error: "This need's MEAL_SLOT payload is malformed — cannot confirm" };
    // PRD §10.4 — the lock (OPEN -> BOOKED) already happened at booking time; slots_confirmed
    // only advances on confirm, same audit principle as raised_amount/kits_funded/units_fulfilled.
    const slotsConfirmed = Math.min(mealSlot.slots_confirmed + contributionAmountOrKits, mealSlot.slots_total);
    const status =
      slotsConfirmed >= mealSlot.slots_total
        ? NeedStatus.FULFILLED
        : slotsConfirmed > 0
          ? NeedStatus.PARTIALLY_FULFILLED
          : need.status;
    return { ok: true, status, payload: { ...mealSlot, slots_confirmed: slotsConfirmed } as Prisma.InputJsonValue };
  }
  if (need.type === NeedType.GOODS) {
    const goods = parseGoodsPayload(need.payload);
    if (!goods) return { ok: false, error: "This need's GOODS payload is malformed — cannot confirm" };
    // PRD §11.3 — a claim is one-shot: no PARTIALLY_FULFILLED, straight LIVE -> FULFILLED. Any
    // other still-pending claims aren't auto-rejected; the beneficiary is expected to reject
    // them once satisfied.
    return { ok: true, status: NeedStatus.FULFILLED, payload: { ...goods, claimed: true } as Prisma.InputJsonValue };
  }
  if (need.type === NeedType.SKILL_REQUEST) {
    const payload = need.payload as Record<string, unknown> | null;
    if (!payload || typeof payload.volunteers_needed !== "number") {
      return { ok: false, error: "This need's SKILL_REQUEST payload is malformed — cannot confirm" };
    }
    const volunteersJoined = Math.min(
      ((payload.volunteers_joined as number) ?? 0) + 1,
      payload.volunteers_needed
    );
    const status =
      volunteersJoined >= payload.volunteers_needed
        ? NeedStatus.FULFILLED
        : volunteersJoined > 0
          ? NeedStatus.PARTIALLY_FULFILLED
          : need.status;
    return { ok: true, status, payload: { ...payload, volunteers_joined: volunteersJoined } as Prisma.InputJsonValue };
  }
  return { ok: false, error: `Confirming a ${need.type} contribution isn't supported yet` };
}

router.post("/:id/confirm", async (req, res) => {
  const contribution = await loadPendingWithNeed(req.params.id);
  if (!contribution) return res.status(404).json({ error: "Contribution not found" });
  if (!canDecide(contribution.need, req.user!.sub, req.user!.role)) {
    return res.status(403).json({ error: "Not allowed to confirm this contribution" });
  }
  if (contribution.status !== "PENDING_CONFIRMATION") {
    return res.status(409).json({ error: `Contribution is already ${contribution.status}` });
  }

  // KIT contributions track progress via `kits`, BLOOD via `units`, MEAL_SLOT always books
  // exactly one date and GOODS is always a single one-shot claim (so both are always "1"),
  // MONEY via `amount` — either way it's "how much this contribution moves the needle," which is
  // what computeFulfilment needs.
  const progressAmount =
    contribution.kind === "KIT"
      ? contribution.kits
      : contribution.kind === "BLOOD"
        ? contribution.units
        : contribution.kind === "MEAL_SLOT" || contribution.kind === "GOODS" || contribution.kind === "SKILL_REQUEST"
          ? 1
          : contribution.amount;
  if (progressAmount == null) {
    return res.status(409).json({ error: "This contribution has no amount/kits/units to confirm — data is inconsistent" });
  }

  const fulfilment = computeFulfilment(contribution.need, progressAmount);
  if (!fulfilment.ok) {
    return res.status(409).json({ error: fulfilment.error });
  }
  if (fulfilment.status !== contribution.need.status) {
    try {
      assertTransition(contribution.need.status, fulfilment.status);
    } catch (err) {
      if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
      throw err;
    }
  }

  const [, updatedContribution] = await prisma.$transaction([
    prisma.need.update({
      where: { id: contribution.need.id },
      data: { status: fulfilment.status, payload: fulfilment.payload },
    }),
    prisma.contribution.update({
      where: { id: contribution.id },
      data: { status: "CONFIRMED", confirmedById: req.user!.sub },
    }),
    // PRD §8.5.3 — the "eligibility reset": a confirmed BLOOD donation moves the donor's
    // lastDonationDate to now, taking them out of the matching pool for the next 90/120 days.
    ...(contribution.kind === "BLOOD"
      ? [prisma.user.update({ where: { id: contribution.donorId }, data: { lastDonationDate: new Date() } })]
      : []),
    // PRD §10.4 — the booked MealSlot moves BOOKED -> CONFIRMED alongside the Contribution.
    ...(contribution.kind === "MEAL_SLOT"
      ? [prisma.mealSlot.updateMany({ where: { contributionId: contribution.id }, data: { status: "CONFIRMED" } })]
      : []),
  ]);

  // PRD §17 — the donor is told their contribution was confirmed. Stored as well as pushed, so
  // the thank-you survives a failed delivery (and the donor without a push token still sees it).
  notify({
    recipientIds: [contribution.donorId],
    type: NotificationType.CONTRIBUTION_CONFIRMED,
    title: "Contribution confirmed 🎉",
    body: `Your contribution for "${contribution.need.title}" has been confirmed. Thank you for helping.`,
    needId: contribution.need.id,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[notify] confirmation alert failed:", err);
  });

  invalidateNeedCaches();
  res.json({ contribution: updatedContribution });
});

// Rejecting a Contribution (unlike rejecting a Need, D-017) doesn't require a reason in v1 —
// the donor can just re-submit with a corrected UTR/screenshot.
router.post("/:id/reject", async (req, res) => {
  const contribution = await loadPendingWithNeed(req.params.id);
  if (!contribution) return res.status(404).json({ error: "Contribution not found" });
  if (!canDecide(contribution.need, req.user!.sub, req.user!.role)) {
    return res.status(403).json({ error: "Not allowed to reject this contribution" });
  }
  if (contribution.status !== "PENDING_CONFIRMATION") {
    return res.status(409).json({ error: `Contribution is already ${contribution.status}` });
  }
  const [updated] = await prisma.$transaction([
    prisma.contribution.update({
      where: { id: contribution.id },
      data: { status: "REJECTED", confirmedById: req.user!.sub },
    }),
    // PRD §10.4 / D-022 — a rejected meal-slot booking must free the date back up (BOOKED ->
    // OPEN, contributionId cleared), or one bad payment claim would permanently block that date
    // from ever being fed. Money/Kit/Blood have no equivalent step: a rejected contribution
    // there just doesn't count, nothing needs "reopening."
    ...(contribution.kind === "MEAL_SLOT"
      ? [
          prisma.mealSlot.updateMany({
            where: { contributionId: contribution.id },
            data: { status: "OPEN", contributionId: null },
          }),
        ]
      : []),
  ]);
  invalidateNeedCaches();
  res.json({ contribution: updated });
});

export default router;
