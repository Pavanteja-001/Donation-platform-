import { Router } from "express";
import { z } from "zod";
import { NeedStatus, NeedType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertTransition, InvalidTransitionError } from "../lib/needLifecycle";
import { notifyEligibleBloodDonors } from "../lib/bloodMatching";

// Admin console RBAC (D-018):
//   ADMIN — full access, including creating/removing STAFF and editing users.
//   STAFF — can verify/accept needs (wired up in Milestone 1) and list all users,
//           but cannot create/edit/delete users, manage staff, change settings,
//           or override confirmed donations. Those actions are ADMIN-only below.
const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN, Role.STAFF));

// Admin + Staff: view/list all users (donors, institutions, hospitals).
router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, phone: true, name: true, role: true, city: true, area: true, createdAt: true },
  });
  res.json({ users });
});

// Admin + Staff: the verification queue and verify/reject actions (D-018 — "verify/accept").
// Default (no `status`) is the queue — PENDING_VERIFICATION only, oldest first, since that's
// the actionable view. Pass `?status=LIVE` etc. (or `?status=ALL`) for general oversight of
// needs regardless of status — used by the admin console's "All needs" tab.
const needsQueryStatusSchema = z.union([z.nativeEnum(NeedStatus), z.literal("ALL")]).optional();

router.get("/needs", async (req, res) => {
  const parsed = needsQueryStatusSchema.safeParse(req.query.status);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  const status = parsed.data ?? NeedStatus.PENDING_VERIFICATION;
  const needs = await prisma.need.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: status === NeedStatus.PENDING_VERIFICATION ? "asc" : "desc" },
    include: { postedBy: { select: { id: true, name: true, phone: true, role: true } } },
  });
  res.json({ needs });
});

router.post("/needs/:id/verify", async (req, res) => {
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  try {
    assertTransition(need.status, NeedStatus.LIVE);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { status: NeedStatus.LIVE, adminVerified: true },
  });

  // PRD §8.4 — one-time push to eligible donors the moment a BLOOD need goes LIVE. Best-effort
  // (see pushNotifications.ts) — never blocks the verify response either way.
  if (updated.type === NeedType.BLOOD) {
    notifyEligibleBloodDonors(updated).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[blood] Failed to notify eligible donors:", err);
    });
  }

  res.json({ need: updated });
});

const rejectSchema = z.object({
  // D-017: rejection always requires a reason, shown live to the poster.
  reason: z.string().min(1, "A rejection reason is required"),
});

router.post("/needs/:id/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const need = await prisma.need.findUnique({ where: { id: req.params.id } });
  if (!need) return res.status(404).json({ error: "Need not found" });
  try {
    assertTransition(need.status, NeedStatus.REJECTED);
  } catch (err) {
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: err.message });
    throw err;
  }
  const updated = await prisma.need.update({
    where: { id: need.id },
    data: { status: NeedStatus.REJECTED, rejectionReason: parsed.data.reason },
  });
  res.json({ need: updated });
});

// Everything below is ADMIN-only — editing users/settings, managing staff, overriding.
const adminOnly = requireRole(Role.ADMIN);

router.patch("/users/:id", adminOnly, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    area: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ user });
});

router.get("/staff", adminOnly, async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: Role.STAFF },
    orderBy: { createdAt: "desc" },
    select: { id: true, phone: true, name: true, createdAt: true, createdByAdminId: true },
  });
  res.json({ staff });
});

router.post("/staff", adminOnly, async (req, res) => {
  const schema = z.object({
    phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
    name: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const existing = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) {
    return res.status(409).json({ error: "A user with this phone number already exists" });
  }
  const staff = await prisma.user.create({
    data: {
      phone: parsed.data.phone,
      name: parsed.data.name,
      role: Role.STAFF,
      createdByAdminId: req.user!.sub,
    },
  });
  res.status(201).json({ staff });
});

router.delete("/staff/:id", adminOnly, async (req, res) => {
  const staff = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!staff || staff.role !== Role.STAFF) {
    return res.status(404).json({ error: "Staff account not found" });
  }
  await prisma.user.delete({ where: { id: staff.id } });
  res.status(204).send();
});

export default router;
