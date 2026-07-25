import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
