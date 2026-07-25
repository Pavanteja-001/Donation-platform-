import { Router } from "express";
import { NeedStatus, NeedType, Prisma } from "@prisma/client";
import type { Need } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { parseMoneyPayload } from "../lib/moneyNeed";
import { parseKitPayload } from "../lib/kitNeed";
import { parseBloodPayload } from "../lib/bloodNeed";

const router = Router();
router.use(requireAuth);

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

  // KIT contributions track progress via `kits`, BLOOD via `units`, MONEY via `amount` — either
  // way it's "how much this contribution moves the needle," which is what computeFulfilment needs.
  const progressAmount =
    contribution.kind === "KIT" ? contribution.kits : contribution.kind === "BLOOD" ? contribution.units : contribution.amount;
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
  ]);
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
  const updated = await prisma.contribution.update({
    where: { id: contribution.id },
    data: { status: "REJECTED", confirmedById: req.user!.sub },
  });
  res.json({ contribution: updated });
});

export default router;
