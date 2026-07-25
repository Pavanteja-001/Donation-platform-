import { Router } from "express";
import { z } from "zod";
import { NeedStatus, NeedType, Prisma, Role, Urgency } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { moneyPayloadInputSchema } from "../lib/moneyNeed";
import { kitPayloadInputSchema, parseKitPayload } from "../lib/kitNeed";
import { bloodPayloadInputSchema } from "../lib/bloodNeed";
import { expireIfPastDeadline, expireManyIfPastDeadline } from "../lib/needExpiry";
import { notifyEligibleBloodDonors } from "../lib/bloodMatching";

const router = Router();
router.use(requireAuth);

// MONEY/KIT needs always carry a server-managed progress field (`raised_amount`/`kits_funded`,
// §7.1/§9.1) — client input for it is dropped, never trusted. Other payload fields pass through
// as-is; validated per-type at submit.
function normalizePayload(type: NeedType, payload: Record<string, unknown> | undefined) {
  if (type === NeedType.MONEY) {
    const { raised_amount: _ignored, ...rest } = payload ?? {};
    return { ...rest, raised_amount: 0 };
  }
  if (type === NeedType.KIT) {
    const { kits_funded: _ignored, ...rest } = payload ?? {};
    return { ...rest, kits_funded: 0 };
  }
  if (type === NeedType.BLOOD) {
    const { units_fulfilled: _ignored, ...rest } = payload ?? {};
    return { ...rest, units_fulfilled: 0 };
  }
  return payload;
}

const createSchema = z.object({
  type: z.nativeEnum(NeedType),
  title: z.string().min(1),
  description: z.string().min(1),
  city: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  deadline: z.coerce.date().optional(),
  // Uploaded via POST /api/uploads/sign (folder: "need-photos") beforehand — these are the
  // resulting public URLs, capped so a need can't carry an unbounded gallery.
  photos: z.array(z.string().url()).max(5).optional(),
  // D-008 — an optional hospital/blood bank/NGO that can co-verify. Validated below (must be an
  // existing INSTITUTION), not in this schema, since that needs a DB lookup.
  linkedInstitutionId: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// Any authenticated USER (donor/beneficiary) or INSTITUTION can post a need (PRD §4).
// Starts as DRAFT (PRD §6.2) — not visible to anyone else until POST /:id/submit.
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  if (parsed.data.linkedInstitutionId) {
    const institution = await prisma.user.findUnique({ where: { id: parsed.data.linkedInstitutionId } });
    if (!institution || institution.role !== Role.INSTITUTION) {
      return res.status(400).json({ error: "linkedInstitutionId must be an existing INSTITUTION account" });
    }
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
  if (parsed.data.linkedInstitutionId) {
    const institution = await prisma.user.findUnique({ where: { id: parsed.data.linkedInstitutionId } });
    if (!institution || institution.role !== Role.INSTITUTION) {
      return res.status(400).json({ error: "linkedInstitutionId must be an existing INSTITUTION account" });
    }
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
// PRD §7.1/§9.1: MONEY/KIT needs need their required payload fields set before submission.
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
  if (need.type === NeedType.KIT) {
    const kitCheck = kitPayloadInputSchema.safeParse(need.payload);
    if (!kitCheck.success) {
      return res.status(400).json({
        error: "A KIT need needs contents, cost_per_kit, kits_needed, and mode set before it can be submitted",
      });
    }
  }
  if (need.type === NeedType.BLOOD) {
    const bloodCheck = bloodPayloadInputSchema.safeParse(need.payload);
    if (!bloodCheck.success) {
      return res.status(400).json({
        error: "A BLOOD need needs blood_group and units_needed set before it can be submitted",
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

// PRD §8.3 / D-008 — the linked institution can verify a need **independently of admin**; either
// path alone is sufficient to reach LIVE ("fast-track" — the institution doesn't wait for
// admin). Not restricted to BLOOD in the route itself (D-008's mechanism is generic), but this
// is where it matters in practice — a hospital/blood bank vouching for a time-critical request.
router.post("/:id/institution-verify", async (req, res) => {
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  if (need.linkedInstitutionId !== req.user!.sub) {
    return res.status(403).json({ error: "Only this need's linked institution can verify it" });
  }
  try {
    assertTransition(need.status, NeedStatus.LIVE);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { status: NeedStatus.LIVE, institutionVerified: true },
  });
  if (updated.type === NeedType.BLOOD) {
    notifyEligibleBloodDonors(updated).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[blood] Failed to notify eligible donors:", err);
    });
  }
  res.json({ need: updated });
});

// PRD §6.8 / D-012 — urgency is admin/institution-verified, **never self-declared**: this is the
// only way it's ever set (createSchema/updateSchema deliberately have no `urgency` field — a
// poster's own value is silently dropped, not rejected, same tamper-guard spirit as
// raised_amount/kits_funded/units_fulfilled). Admin/Staff can set it on anything; the linked
// institution only on needs actually linked to them. Works on any non-terminal status, not just
// at verify time — a already-LIVE need can still be escalated if the situation changes.
const urgencySchema = z.object({ urgency: z.nativeEnum(Urgency) });
const NON_TERMINAL: NeedStatus[] = [
  NeedStatus.DRAFT,
  NeedStatus.PENDING_VERIFICATION,
  NeedStatus.LIVE,
  NeedStatus.PARTIALLY_FULFILLED,
];

router.post("/:id/urgency", async (req, res) => {
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  const isLinkedInstitution = need.linkedInstitutionId === req.user!.sub;
  if (!isAdminOrStaff && !isLinkedInstitution) {
    return res.status(403).json({ error: "Only admin/staff or this need's linked institution can set urgency" });
  }
  if (!NON_TERMINAL.includes(need.status)) {
    return res.status(409).json({ error: `Cannot change urgency on a ${need.status} need` });
  }
  const parsed = urgencySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const updated = await prisma.need.update({ where: { id: need.id }, data: { urgency: parsed.data.urgency } });
  // Escalating a LIVE BLOOD need to Emergency re-triggers the eligible-donor push (§8.4) — the
  // whole point of being able to escalate after the fact.
  if (updated.type === NeedType.BLOOD && updated.status === NeedStatus.LIVE && parsed.data.urgency === Urgency.EMERGENCY) {
    notifyEligibleBloodDonors(updated).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[blood] Failed to notify eligible donors:", err);
    });
  }
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

const moneyDonateSchema = z.object({
  amount: z.number().int().positive(),
  utr: z.string().min(1),
  proofUrl: z.string().url().optional(),
});

// KIT donations (§9.2): `utr` is required for mode=MONEY (a real payment happened) and must be
// absent for mode=DELIVER (no money moves through the platform for a physical delivery pledge)
// — checked against the need's actual mode in the handler below, not here.
const kitDonateSchema = z.object({
  kits: z.number().int().positive(),
  utr: z.string().min(1).optional(),
  proofUrl: z.string().url().optional(),
});

// PRD §8.5 — a blood "respond" is a pledge, never a payment: no utr/proofUrl at all.
const bloodDonateSchema = z.object({
  units: z.number().int().positive(),
});

async function createContribution(res: import("express").Response, data: Prisma.ContributionUncheckedCreateInput) {
  try {
    const contribution = await prisma.contribution.create({ data });
    res.status(201).json({ contribution });
  } catch (err) {
    // D-019: UTR uniqueness is a hard DB constraint (Prisma P2002 on the unique `utr` column).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "This UTR has already been used for a contribution" });
    }
    throw err;
  }
}

// PRD §7.2/§9.2 — the donate step. No payment gateway (D-001): for MONEY needs, and for KIT
// needs in mode=MONEY, the donor pays the beneficiary's UPI ID directly and submits proof here;
// KIT needs in mode=DELIVER skip payment entirely — the pledge itself is the contribution.
// Starts PENDING_CONFIRMATION (§6.5).
router.post("/:id/contributions", async (req, res) => {
  let need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  need = await expireIfPastDeadline(need);

  const fundable: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED];
  if (!fundable.includes(need.status)) {
    // Covers D-013's "stops accepting further contributions" once FULFILLED, and any other
    // non-fundable status (DRAFT/PENDING_VERIFICATION/REJECTED/EXPIRED/CANCELLED).
    return res.status(409).json({ error: `Cannot contribute to a need with status ${need.status}` });
  }

  if (need.type === NeedType.MONEY) {
    const parsed = moneyDonateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }
    return createContribution(res, {
      kind: "MONEY",
      amount: parsed.data.amount,
      utr: parsed.data.utr,
      proofUrl: parsed.data.proofUrl,
      needId: need.id,
      donorId: req.user!.sub,
    });
  }

  if (need.type === NeedType.KIT) {
    const kit = parseKitPayload(need.payload);
    if (!kit) {
      return res.status(409).json({ error: "This need's KIT payload is malformed — cannot contribute" });
    }
    const parsed = kitDonateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }
    if (kit.mode === "MONEY" && !parsed.data.utr) {
      return res.status(400).json({ error: "utr is required for a money-mode kit contribution" });
    }
    if (kit.mode === "DELIVER" && parsed.data.utr) {
      return res.status(400).json({ error: "A deliver-mode kit contribution has no payment — don't send a utr" });
    }
    return createContribution(res, {
      kind: "KIT",
      kits: parsed.data.kits,
      amount: kit.mode === "MONEY" ? parsed.data.kits * kit.cost_per_kit : undefined,
      utr: kit.mode === "MONEY" ? parsed.data.utr : undefined,
      proofUrl: parsed.data.proofUrl,
      needId: need.id,
      donorId: req.user!.sub,
    });
  }

  if (need.type === NeedType.BLOOD) {
    const parsed = bloodDonateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }
    // §8.5.1 — responding is itself the donor's consent to share their response with the
    // beneficiary/institution; no separate consent step.
    return createContribution(res, {
      kind: "BLOOD",
      units: parsed.data.units,
      needId: need.id,
      donorId: req.user!.sub,
    });
  }

  return res.status(400).json({ error: "Only MONEY, KIT, and BLOOD needs accept contributions" });
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
