import { Router } from "express";
import { z } from "zod";
import { NeedStatus, NeedType, Prisma, Urgency } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { moneyPayloadInputSchema } from "../lib/moneyNeed";
import { expireIfPastDeadline, expireManyIfPastDeadline } from "../lib/needExpiry";

const router = Router();
router.use(requireAuth);

// A MONEY need always carries a server-managed `raised_amount` (§7.1) — client input for it is
// dropped, never trusted. Other payload fields pass through as-is; validated per-type at submit.
function normalizePayload(type: NeedType, payload: Record<string, unknown> | undefined) {
  if (!payload) return type === NeedType.MONEY ? { raised_amount: 0 } : undefined;
  const { raised_amount: _ignored, ...rest } = payload;
  return type === NeedType.MONEY ? { ...rest, raised_amount: 0 } : rest;
}

const createSchema = z.object({
  type: z.nativeEnum(NeedType),
  title: z.string().min(1),
  description: z.string().min(1),
  city: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  deadline: z.coerce.date().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// Any authenticated USER (donor/beneficiary) or INSTITUTION can post a need (PRD §4).
// Starts as DRAFT (PRD §6.2) — not visible to anyone else until POST /:id/submit.
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const need = await prisma.need.create({
    data: {
      ...parsed.data,
      payload: normalizePayload(parsed.data.type, parsed.data.payload) as Prisma.InputJsonValue | undefined,
      postedById: req.user!.sub,
      status: NeedStatus.DRAFT,
    },
  });
  res.status(201).json({ need });
});

async function loadOwnedDraft(needId: string, userId: string) {
  const need = await prisma.need.findUnique({ where: { id: needId } });
  if (!need || need.postedById !== userId) return null;
  return need;
}

const updateSchema = createSchema.partial();

// Edit is only allowed pre-submission — once PENDING_VERIFICATION, the poster's story is
// what admin is verifying, so changing it after the fact would undermine that. This is also
// how a re-submitted (EXPIRED -> DRAFT) need gets fixed up, e.g. a pushed-out deadline.
router.patch("/:id", async (req, res) => {
  const need = await loadOwnedDraft(req.params.id, req.user!.sub);
  if (!need) return res.status(404).json({ error: "Need not found" });
  if (need.status !== NeedStatus.DRAFT) {
    return res.status(409).json({ error: "Only a DRAFT need can be edited" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const type = parsed.data.type ?? need.type;
  const { payload, ...rest } = parsed.data;
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: {
      ...rest,
      ...(payload !== undefined ? { payload: normalizePayload(type, payload) as Prisma.InputJsonValue } : {}),
    },
  });
  res.json({ need: updated });
});

// PRD §6.2: post -> PENDING_VERIFICATION, awaiting admin (and/or linked-institution) review.
// PRD §7.1: a MONEY need needs target_amount + upi_id set before it can go out for verification.
router.post("/:id/submit", async (req, res) => {
  const need = await loadOwnedDraft(req.params.id, req.user!.sub);
  if (!need) return res.status(404).json({ error: "Need not found" });
  try {
    assertTransition(need.status, NeedStatus.PENDING_VERIFICATION);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  if (need.type === NeedType.MONEY) {
    const moneyCheck = moneyPayloadInputSchema.safeParse(need.payload);
    if (!moneyCheck.success) {
      return res.status(400).json({
        error: "A MONEY need needs target_amount and upi_id set before it can be submitted",
      });
    }
  }
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { status: NeedStatus.PENDING_VERIFICATION },
  });
  res.json({ need: updated });
});

// PRD §7.4 / D-013: an EXPIRED need can be re-submitted. Back to DRAFT so the poster can fix
// it up (e.g. push the deadline out) via PATCH, then submit again through the normal flow.
router.post("/:id/resubmit", async (req, res) => {
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need || need.postedById !== req.user!.sub) return res.status(404).json({ error: "Need not found" });
  try {
    assertTransition(need.status, NeedStatus.DRAFT);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  const updated = await prisma.need.update({ where: { id: need.id }, data: { status: NeedStatus.DRAFT } });
  res.json({ need: updated });
});

// The poster (or an admin/staff, e.g. on request) can withdraw a need any time before it's
// a terminal state.
router.post("/:id/cancel", async (req, res) => {
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  const isOwner = need.postedById === req.user!.sub;
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  if (!isOwner && !isAdminOrStaff) {
    return res.status(403).json({ error: "Not allowed to cancel this need" });
  }
  try {
    assertTransition(need.status, NeedStatus.CANCELLED);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { status: NeedStatus.CANCELLED },
  });
  res.json({ need: updated });
});

const listQuerySchema = z.object({
  type: z.nativeEnum(NeedType).optional(),
});

// The public "browse live needs" feed (PRD §6.8): urgency (Emergency pinned) then recency.
// LIVE and PARTIALLY_FULFILLED are both "live" from a donor's point of view — the target
// isn't fully met yet.
const URGENCY_RANK: Record<Urgency, number> = { EMERGENCY: 0, URGENT: 1, NORMAL: 2 };

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
  }
  const candidates = await prisma.need.findMany({
    where: {
      status: { in: [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED] },
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { postedBy: { select: { id: true, name: true, role: true } } },
  });
  // Lazily expire past-deadline needs (§7.4) before deciding what's actually still live.
  const checked = await expireManyIfPastDeadline(candidates);
  const needs = checked.filter((n) => n.status === NeedStatus.LIVE || n.status === NeedStatus.PARTIALLY_FULFILLED);
  needs.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
  res.json({ needs });
});

// Must come before GET /:id (Express matches route order — "/:id" would otherwise swallow
// "/mine" with id="mine"). Every need the caller posted, any status — DRAFT included — so a
// poster can track their own need's progress through verification without knowing its id.
router.get("/mine", async (req, res) => {
  const needs = await prisma.need.findMany({
    where: { postedById: req.user!.sub },
    orderBy: { createdAt: "desc" },
    include: { postedBy: { select: { id: true, name: true, role: true } } },
  });
  const checked = await expireManyIfPastDeadline(needs);
  res.json({ needs: checked });
});

router.get("/:id", async (req, res) => {
  let need = await prisma.need.findUnique({
    where: { id: req.params.id },
    include: { postedBy: { select: { id: true, name: true, role: true } } },
  });
  if (!need) return res.status(404).json({ error: "Need not found" });
  need = { ...(await expireIfPastDeadline(need)), postedBy: need.postedBy };

  const isOwner = need.postedById === req.user!.sub;
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  const publicStatuses: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED, NeedStatus.FULFILLED];
  const isPubliclyVisible = publicStatuses.includes(need.status);
  if (!isOwner && !isAdminOrStaff && !isPubliclyVisible) {
    return res.status(404).json({ error: "Need not found" });
  }
  res.json({ need });
});

const donateSchema = z.object({
  amount: z.number().int().positive(),
  utr: z.string().min(1),
  proofUrl: z.string().url().optional(),
});

// PRD §7.2 — the donate step. No payment gateway (D-001): the donor pays the beneficiary's
// UPI ID directly, then submits proof here. Starts PENDING_CONFIRMATION (§6.5).
router.post("/:id/contributions", async (req, res) => {
  let need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  need = await expireIfPastDeadline(need);

  if (need.type !== NeedType.MONEY) {
    return res.status(400).json({ error: "Only MONEY needs accept contributions in this milestone" });
  }
  const fundable: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED];
  if (!fundable.includes(need.status)) {
    // Covers D-013's "stops accepting further contributions" once FULFILLED, and any other
    // non-fundable status (DRAFT/PENDING_VERIFICATION/REJECTED/EXPIRED/CANCELLED).
    return res.status(409).json({ error: `Cannot contribute to a need with status ${need.status}` });
  }
  const parsed = donateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  try {
    const contribution = await prisma.contribution.create({
      data: { ...parsed.data, needId: need.id, donorId: req.user!.sub },
    });
    res.status(201).json({ contribution });
  } catch (err) {
    // D-019: UTR uniqueness is a hard DB constraint (Prisma P2002 on the unique `utr` column).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "This UTR has already been used for a contribution" });
    }
    throw err;
  }
});

// Owner (beneficiary) or Admin/Staff only — a donor sees their own contributions via a
// "my contributions" endpoint, which is a later milestone (not needed to prove the core loop).
router.get("/:id/contributions", async (req, res) => {
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  const isOwner = need.postedById === req.user!.sub;
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  if (!isOwner && !isAdminOrStaff) {
    return res.status(403).json({ error: "Not allowed to view these contributions" });
  }
  const contributions = await prisma.contribution.findMany({
    where: { needId: need.id },
    orderBy: { createdAt: "desc" },
    include: { donor: { select: { id: true, name: true, phone: true } } },
  });
  res.json({ contributions });
});

export default router;
