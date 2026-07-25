import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requestOtp, verifyOtp } from "../lib/otp";
import { signAuthToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";

const router = Router();

const phoneSchema = z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number");

// Roles a new account can self-register as. ADMIN/STAFF accounts are provisioned
// separately (STAFF by an existing ADMIN — see routes/admin.ts; ADMIN via seed script).
const SELF_REGISTERABLE_ROLES = [Role.USER, Role.INSTITUTION] as const;

router.post("/otp/request", (req, res) => {
  const parsed = phoneSchema.safeParse(req.body?.phone);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid phone" });
  }
  requestOtp(parsed.data);
  res.json({ ok: true });
});

const verifySchema = z.object({
  phone: phoneSchema,
  code: z.string().min(4).max(8),
  role: z.enum(SELF_REGISTERABLE_ROLES).optional(),
  name: z.string().min(1).optional(),
});

router.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const { phone, code, role, name } = parsed.data;

  if (!verifyOtp(phone, code)) {
    return res.status(401).json({ error: "Incorrect or expired OTP" });
  }

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, name, role: role ?? Role.USER },
    });
  }

  const token = signAuthToken({ sub: user.id, role: user.role, phone: user.phone });
  res.json({ token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

export default router;
