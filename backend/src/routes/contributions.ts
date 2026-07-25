import { Router } from "express";
import { NeedStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { parseMoneyPayload } from "../lib/moneyNeed";

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

// PRD §7.3 — on confirm: raised_amount += amount, clamped to target_amount (avoids >100%
// display, D-013), and the Need advances PARTIALLY_FULFILLED -> FULFILLED as it crosses target.
router.post("/:id/confirm", async (req, res) => {
  const contribution = await loadPendingWithNeed(req.params.id);
  if (!contribution) return res.status(404).json({ error: "Contribution not found" });
  if (!canDecide(contribution.need, req.user!.sub, req.user!.role)) {
    return res.status(403).json({ error: "Not allowed to confirm this contribution" });
  }
  if (contribution.status !== "PENDING_CONFIRMATION") {
    return res.status(409).json({ error: `Contribution is already ${contribution.status}` });
  }

  const money = parseMoneyPayload(contribution.need.payload);
  if (!money) {
    return res.status(409).json({ error: "This need's MONEY payload is malformed — cannot confirm" });
  }
  const raisedAmount = Math.min(money.raised_amount + contribution.amount, money.target_amount);
  let needStatus = contribution.need.status;
  if (raisedAmount >= money.target_amount) needStatus = NeedStatus.FULFILLED;
  else if (raisedAmount > 0) needStatus = NeedStatus.PARTIALLY_FULFILLED;
  if (needStatus !== contribution.need.status) {
    try {
      assertTransition(contribution.need.status, needStatus);
    } catch (err) {
      if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
      throw err;
    }
  }

  const [, updatedContribution] = await prisma.$transaction([
    prisma.need.update({
      where: { id: contribution.need.id },
      data: {
        status: needStatus,
        payload: { ...money, raised_amount: raisedAmount } as Prisma.InputJsonValue,
      },
    }),
    prisma.contribution.update({
      where: { id: contribution.id },
      data: { status: "CONFIRMED", confirmedById: req.user!.sub },
    }),
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
