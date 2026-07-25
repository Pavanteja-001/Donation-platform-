import { Router } from "express";
import { z } from "zod";
import { BloodGroup, Gender, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requestOtp, verifyOtp } from "../lib/otp";
import { signAuthToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { computeEligibility } from "../lib/bloodEligibility";

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
  // Full user object, same shape as GET /me — a hand-picked subset here previously meant a
  // client trusting this response right after login (rather than re-fetching /me) would see
  // fields like the blood profile as missing/undefined instead of null until their next fetch.
  res.json({ token, user, bloodEligibility: computeEligibility(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });
  // PRD §8.2 — computed fresh on every read, never stored (see the lib for why).
  res.json({ user, bloodEligibility: computeEligibility(user) });
});

// Self-service profile edits — name/location (any role) and the blood donor profile (PRD §8.1,
// opt-in). `expoPushToken` is registered here too rather than a separate endpoint since it's
// the same "update my own profile" action from the client's point of view.
//
// Deliberately excluded: `lastDonationDate` is NOT client-settable — letting a donor freely set
// it would be a straightforward way to always appear eligible (set it to the distant past, or
// never set it), which is exactly the self-declared-signal gaming problem D-012 already rejected
// for urgency. It's only ever set by the backend when a BLOOD contribution is confirmed (§8.5).
const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  availableToDonate: z.boolean().optional(),
  expoPushToken: z.string().min(1).optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const user = await prisma.user.update({ where: { id: req.user!.sub }, data: parsed.data });
  res.json({ user });
});

export default router;
