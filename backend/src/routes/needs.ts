import { Router } from "express";
import { z } from "zod";
import { KycStatus, NeedStatus, NeedType, Prisma, Role, Urgency, ContributionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { moneyPayloadInputSchema } from "../lib/moneyNeed";
import { kitPayloadInputSchema, parseKitPayload } from "../lib/kitNeed";
import { bloodPayloadInputSchema } from "../lib/bloodNeed";
import { parseMealSlotPayload, dedupeDates } from "../lib/mealSlotNeed";
import { goodsPayloadInputSchema, parseGoodsPayload } from "../lib/goodsNeed";
import { expireIfPastDeadline, expireManyIfPastDeadline } from "../lib/needExpiry";
import { notifyEligibleBloodDonors } from "../lib/bloodMatching";

const router = Router();
router.use(requireAuth);

// D-022 — thrown inside the booking transaction when the conditional UPDATE affects 0 rows
// (someone else booked this date first); caught below to turn into a 409, and rolls back the
// Contribution created earlier in the same transaction.
class SlotAlreadyBookedError extends Error {}

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
  if (type === NeedType.GOODS) {
    const { claimed: _ignored, ...rest } = payload ?? {};
    return { ...rest, claimed: false };
  }
  if (type === NeedType.MEAL_SLOT) {
    // `dates` drives MealSlot row creation (§10.2) and never lives in the persisted payload
    // itself — the per-date state is the MealSlot table, not this JSON. `slots_total` is set by
    // the caller (createMealSlotNeed/patchMealSlotNeed below) based on how many rows actually
    // got created, not trusted from the client.
    const { slots_confirmed: _ignored, dates: _datesIgnored, slots_total, ...rest } = payload ?? {};
    return { ...rest, slots_total: typeof slots_total === "number" ? slots_total : 0, slots_confirmed: 0 };
  }
  return payload;
}

// PRD §10.2 — MEAL_SLOT needs a MealSlot child row per date, created atomically alongside the
// Need itself (or replaced wholesale on a DRAFT edit, see PATCH below). Returns the created Need.
async function createMealSlotNeed(
  postedById: string,
  base: { title: string; description: string; city?: string; area?: string; deadline?: Date; photos?: string[]; linkedInstitutionId?: string },
  rawPayload: Record<string, unknown> | undefined
) {
  const parsedDates = z.array(z.coerce.date()).max(60).safeParse((rawPayload as { dates?: unknown })?.dates);
  const dates = parsedDates.success ? dedupeDates(parsedDates.data) : [];
  return prisma.$transaction(async (tx) => {
    const need = await tx.need.create({
      data: {
        ...base,
        payload: normalizePayload(NeedType.MEAL_SLOT, { ...rawPayload, slots_total: dates.length }) as Prisma.InputJsonValue,
        postedById,
        status: NeedStatus.DRAFT,
        type: NeedType.MEAL_SLOT,
      },
    });
    if (dates.length > 0) {
      await tx.mealSlot.createMany({ data: dates.map((date) => ({ needId: need.id, date })) });
    }
    return need;
  });
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
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.role === Role.INSTITUTION && user.kycStatus !== KycStatus.APPROVED) {
    return res.status(403).json({
      error: `Your organization must be approved by an administrator before you can submit needs. Current status: ${user.kycStatus}.`,
    });
  }

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
  if (parsed.data.type === NeedType.MEAL_SLOT) {
    const { type: _type, payload, ...base } = parsed.data;
    const need = await createMealSlotNeed(req.user!.sub, base, payload);
    return res.status(201).json({ need });
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
  // MEAL_SLOT with new `dates` while still DRAFT: wholesale-replace the MealSlot rows (safe —
  // nothing can be BOOKED yet, since booking only opens up at LIVE) rather than trying to diff
  // the old/new date lists. Same "fixed set, edit means replace" spirit as §10.2.
  if (type === NeedType.MEAL_SLOT && payload !== undefined && "dates" in payload) {
    const parsedDates = z.array(z.coerce.date()).max(60).safeParse((payload as { dates?: unknown }).dates);
    const dates = parsedDates.success ? dedupeDates(parsedDates.data) : [];
    const updated = await prisma.$transaction(async (tx) => {
      await tx.mealSlot.deleteMany({ where: { needId: need.id } });
      const u = await tx.need.update({
        where: { id: need.id },
        data: { ...rest, payload: normalizePayload(type, { ...payload, slots_total: dates.length }) as Prisma.InputJsonValue },
      });
      if (dates.length > 0) {
        await tx.mealSlot.createMany({ data: dates.map((date) => ({ needId: need.id, date })) });
      }
      return u;
    });
    return res.json({ need: updated });
  }
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
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (user && user.role === Role.INSTITUTION && user.kycStatus !== KycStatus.APPROVED) {
    return res.status(403).json({
      error: `Your organization must be approved by an administrator before you can submit needs. Current status: ${user.kycStatus}.`,
    });
  }

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
  if (need.type === NeedType.MEAL_SLOT) {
    const mealSlot = parseMealSlotPayload(need.payload);
    if (!mealSlot || mealSlot.slots_total < 1) {
      return res.status(400).json({
        error: "A MEAL_SLOT need needs meal_type, cost_per_slot, mode, and at least one date set before it can be submitted",
      });
    }
  }
  if (need.type === NeedType.GOODS) {
    const goodsCheck = goodsPayloadInputSchema.safeParse(need.payload);
    if (!goodsCheck.success) {
      return res.status(400).json({
        error: "A GOODS need needs item and condition set before it can be submitted",
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
    include: {
      postedBy: { select: { id: true, name: true, role: true } },
      // MEAL_SLOT only (empty for every other type) — donors need the actual per-date
      // breakdown to pick a slot (§10.5), not just an aggregate count.
      mealSlots: { orderBy: { date: "asc" } },
    },
  });
  if (!need) return res.status(404).json({ error: "Need not found" });
  need = { ...(await expireIfPastDeadline(need)), postedBy: need.postedBy, mealSlots: need.mealSlots };

  const isOwner = need.postedById === req.user!.sub;
  const isAdminOrStaff = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  const publicStatuses: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED, NeedStatus.FULFILLED];
  const isPubliclyVisible = publicStatuses.includes(need.status);
  if (!isOwner && !isAdminOrStaff && !isPubliclyVisible) {
    return res.status(404).json({ error: "Need not found" });
  }

  const myContribution = await prisma.contribution.findFirst({
    where: {
      needId: need.id,
      donorId: req.user!.sub,
      status: { in: [ContributionStatus.PENDING_CONFIRMATION, ContributionStatus.CONFIRMED] },
    },
    select: { id: true, status: true, kind: true },
  });

  res.json({ need, myContribution });
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

// PRD §11.3 — a GOODS "claim" is a pledge, never a payment: no amount/kits/utr at all, just an
// optional handover photo (reuses proofUrl, same as Kit's DELIVER mode).
const goodsClaimSchema = z.object({
  proofUrl: z.string().url().optional(),
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

  // Check for duplicate pending responses (Chunk 6)
  const existingPending = await prisma.contribution.findFirst({
    where: {
      needId: need.id,
      donorId: req.user!.sub,
      status: ContributionStatus.PENDING_CONFIRMATION,
    },
  });
  if (existingPending) {
    return res.status(409).json({
      error: "You already have a pending response for this request.",
    });
  }

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

  if (need.type === NeedType.GOODS) {
    const parsed = goodsClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }
    // PRD §11.3 — a claim is a pledge, never a payment: no amount/kits/units/utr at all.
    // Deliberately no locking (unlike Meal-slot's D-022) — multiple donors can submit competing
    // pending claims; the beneficiary picks one to confirm.
    return createContribution(res, {
      kind: "GOODS",
      proofUrl: parsed.data.proofUrl,
      needId: need.id,
      donorId: req.user!.sub,
    });
  }

  return res.status(400).json({ error: "Only MONEY, KIT, BLOOD, and GOODS needs accept contributions" });
});

// MEAL_SLOT donations (§10.4): `utr` required for mode=MONEY, forbidden for mode=DELIVER — same
// shape as KIT's rule (§9.2), checked against the need's actual mode below.
const mealSlotBookSchema = z.object({
  utr: z.string().min(1).optional(),
  proofUrl: z.string().url().optional(),
});

// PRD §10.3 / D-022 — booking a date. This is deliberately its own endpoint, not a branch of
// POST /:id/contributions, because it needs a specific slotId and the locking transaction below
// — genuinely different shape from "donate an amount/kits/units against the need as a whole."
router.post("/:id/meal-slots/:slotId/book", async (req, res) => {
  let need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need || need.type !== NeedType.MEAL_SLOT) return res.status(404).json({ error: "Need not found" });
  need = await expireIfPastDeadline(need);

  const fundable: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED];
  if (!fundable.includes(need.status)) {
    return res.status(409).json({ error: `Cannot book a slot on a need with status ${need.status}` });
  }

  const mealSlot = parseMealSlotPayload(need.payload);
  if (!mealSlot) {
    return res.status(409).json({ error: "This need's MEAL_SLOT payload is malformed — cannot book" });
  }
  const parsed = mealSlotBookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  if (mealSlot.mode === "MONEY" && !parsed.data.utr) {
    return res.status(400).json({ error: "utr is required for a money-mode meal-slot booking" });
  }
  if (mealSlot.mode === "DELIVER" && parsed.data.utr) {
    return res.status(400).json({ error: "A deliver-mode meal-slot booking has no payment — don't send a utr" });
  }

  const slot = await prisma.mealSlot.findUnique({ where: { id: req.params.slotId } });
  if (!slot || slot.needId !== need.id) {
    return res.status(404).json({ error: "Meal slot not found" });
  }

  try {
    const contribution = await prisma.$transaction(async (tx) => {
      const created = await tx.contribution.create({
        data: {
          kind: "MEAL_SLOT",
          amount: mealSlot.mode === "MONEY" ? mealSlot.cost_per_slot : undefined,
          utr: mealSlot.mode === "MONEY" ? parsed.data.utr : undefined,
          proofUrl: parsed.data.proofUrl,
          mealSlotDate: slot.date,
          needId: need!.id,
          donorId: req.user!.sub,
        },
      });
      // D-022 — the lock: a conditional UPDATE, not a read-then-write. Exactly one of two
      // racing requests can affect this row (Postgres serializes concurrent UPDATEs to the same
      // row); the loser's `count` is 0, and throwing here rolls back the Contribution created
      // above too (same transaction).
      const result = await tx.mealSlot.updateMany({
        where: { id: slot.id, status: "OPEN" },
        data: { status: "BOOKED", contributionId: created.id },
      });
      if (result.count === 0) {
        throw new SlotAlreadyBookedError();
      }
      return created;
    });
    res.status(201).json({ contribution });
  } catch (err) {
    if (err instanceof SlotAlreadyBookedError) {
      return res.status(409).json({ error: "This date was just booked by someone else — pick another" });
    }
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
