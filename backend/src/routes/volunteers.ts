import { Router } from "express";
import { z } from "zod";
import { InstitutionType, NotificationType, Role, VolunteerStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { notify } from "../lib/notifications";

const router = Router();
router.use(requireAuth);

/**
 * The NGO's side: its public team, and the volunteer applications it receives.
 *
 * Every route scopes by the caller's own id rather than trusting an id in the path — an NGO must
 * never be able to read or decide another organisation's applications, which carry applicants'
 * phone numbers.
 */

async function requireNgo(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, institutionType: true },
  });
  return !!me && me.role === Role.INSTITUTION && me.institutionType === InstitutionType.NGO;
}

// --- Team ----------------------------------------------------------------------------------

const teamMemberSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(120),
  role: z.string().trim().max(120).optional(),
  photoUrl: z.string().url().optional(),
  position: z.number().int().min(0).max(999).optional(),
});

router.get("/team", async (req, res) => {
  const team = await prisma.teamMember.findMany({
    where: { institutionId: req.user!.sub },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  res.json({ team });
});

router.post("/team", async (req, res) => {
  if (!(await requireNgo(req.user!.sub))) {
    return res.status(403).json({ error: "Only an NGO account can manage a team" });
  }
  const parsed = teamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const member = await prisma.teamMember.create({
    data: { ...parsed.data, institutionId: req.user!.sub },
  });
  res.status(201).json({ member });
});

router.patch("/team/:id", async (req, res) => {
  const parsed = teamMemberSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  // updateMany, so ownership is part of the WHERE rather than a separate check that could be
  // forgotten in a later refactor.
  const result = await prisma.teamMember.updateMany({
    where: { id: req.params.id, institutionId: req.user!.sub },
    data: parsed.data,
  });
  if (result.count === 0) return res.status(404).json({ error: "Team member not found" });
  res.status(204).send();
});

router.delete("/team/:id", async (req, res) => {
  const result = await prisma.teamMember.deleteMany({
    where: { id: req.params.id, institutionId: req.user!.sub },
  });
  if (result.count === 0) return res.status(404).json({ error: "Team member not found" });
  res.status(204).send();
});

// --- Applications --------------------------------------------------------------------------

/** Applications to this NGO. Pending first — those are what need a decision. */
router.get("/applications", async (req, res) => {
  const applications = await prisma.volunteerApplication.findMany({
    where: { ngoId: req.user!.sub },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      // Contact details: an NGO taking someone on as a member has to be able to reach them.
      user: { select: { id: true, name: true, phone: true, city: true, area: true, createdAt: true } },
    },
    take: 200,
  });
  res.json({ applications });
});

async function loadOwnApplication(id: string, ngoId: string) {
  const application = await prisma.volunteerApplication.findUnique({ where: { id } });
  if (!application || application.ngoId !== ngoId) return null;
  return application;
}

router.post("/applications/:id/approve", async (req, res) => {
  const application = await loadOwnApplication(req.params.id, req.user!.sub);
  if (!application) return res.status(404).json({ error: "Application not found" });
  if (application.status === VolunteerStatus.APPROVED) {
    return res.status(409).json({ error: "This volunteer is already approved" });
  }

  const updated = await prisma.volunteerApplication.update({
    where: { id: application.id },
    data: { status: VolunteerStatus.APPROVED, rejectionReason: null },
  });

  // Approval is what makes them an official member — the mobile profile reads this status.
  notify({
    recipientIds: [application.userId],
    type: NotificationType.CONTRIBUTION_CONFIRMED,
    title: "You're now a volunteer 🎉",
    body: "Your application was approved. You'll see the organisation on your profile.",
  }).catch(() => {});

  res.json({ application: updated });
});

const rejectSchema = z.object({ reason: z.string().trim().min(1, "A reason is required") });

router.post("/applications/:id/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const application = await loadOwnApplication(req.params.id, req.user!.sub);
  if (!application) return res.status(404).json({ error: "Application not found" });

  const updated = await prisma.volunteerApplication.update({
    where: { id: application.id },
    data: { status: VolunteerStatus.REJECTED, rejectionReason: parsed.data.reason },
  });

  notify({
    recipientIds: [application.userId],
    type: NotificationType.NEED_STATUS,
    title: "Volunteer application update",
    body: parsed.data.reason,
  }).catch(() => {});

  res.json({ application: updated });
});

/** Remove someone who no longer volunteers, without leaving a misleading rejection on record. */
router.delete("/applications/:id", async (req, res) => {
  const result = await prisma.volunteerApplication.deleteMany({
    where: { id: req.params.id, ngoId: req.user!.sub },
  });
  if (result.count === 0) return res.status(404).json({ error: "Application not found" });
  res.status(204).send();
});

export default router;
