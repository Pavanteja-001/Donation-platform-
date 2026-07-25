import { Router } from "express";
import { z } from "zod";
import { NeedStatus, NeedType, Prisma, Urgency } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  type: z.nativeEnum(NeedType),
  title: z.string().min(1),
  description: z.string().min(1),
  city: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
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
      payload: parsed.data.payload as Prisma.InputJsonValue | undefined,
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
// what admin is verifying, so changing it after the fact would undermine that.
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
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { ...parsed.data, payload: parsed.data.payload as Prisma.InputJsonValue | undefined },
  });
  res.json({ need: updated });
});

// PRD §6.2: post -> PENDING_VERIFICATION, awaiting admin (and/or linked-institution) review.
router.post("/:id/submit", async (req, res) => {
  const need = await loadOwnedDraft(req.params.id, req.user!.sub);
  if (!need) return res.status(404).json({ error: "Need not found" });
  try {
    assertTransition(need.status, NeedStatus.PENDING_VERIFICATION);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { status: NeedStatus.PENDING_VERIFICATION },
  });
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
  const needs = await prisma.need.findMany({
    where: {
      status: { in: [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED] },
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { postedBy: { select: { id: true, name: true, role: true } } },
  });
  needs.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
  res.json({ needs });
});

router.get("/:id", async (req, res) => {
  const need = await prisma.need.findUnique({
    where: { id: req.params.id },
    include: { postedBy: { select: { id: true, name: true, role: true } } },
  });
  if (!need) return res.status(404).json({ error: "Need not found" });

  const isOwner = need.postedById === req.user!.sub;
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  const publicStatuses: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED, NeedStatus.FULFILLED];
  const isPubliclyVisible = publicStatuses.includes(need.status);
  if (!isOwner && !isAdminOrStaff && !isPubliclyVisible) {
    return res.status(404).json({ error: "Need not found" });
  }
  res.json({ need });
});

export default router;
