import { Router } from "express";
import { z } from "zod";
import { InstitutionType, KycStatus, NotificationType, Role, VolunteerStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { notify } from "../lib/notifications";

const router = Router();
router.use(requireAuth);

/**
 * The public NGO directory, and the volunteer application flow.
 *
 * Mirrors the orphanage directory deliberately — same visibility rule (KYC-approved only), same
 * "public profile is separate from KYC paperwork" split — so a donor learns one set of patterns
 * rather than two.
 */

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  legalName: true,
  city: true,
  area: true,
  address: true,
  about: true,
  coverPhotoUrl: true,
  // `kycPhotos` is never selected: registration certificates and ID proofs are for admin review,
  // not for a public listing. The gallery is the institution's own published work.
  galleryPhotos: true,
} as const;

const LISTED_WHERE = {
  role: Role.INSTITUTION,
  institutionType: InstitutionType.NGO,
  kycStatus: KycStatus.APPROVED,
};

const listQuerySchema = z.object({ search: z.string().trim().min(1).max(80).optional() });

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
  }
  const search = parsed.data.search;

  const ngos = await prisma.user.findMany({
    where: {
      ...LISTED_WHERE,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { legalName: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { area: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      ...PUBLIC_FIELDS,
      // Counts rather than the rows themselves — the list only needs "12 team members", and
      // sending every member of every NGO would balloon the payload.
      _count: { select: { teamMembers: true, volunteerApplicants: { where: { status: VolunteerStatus.APPROVED } } } },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  res.json({
    ngos: ngos.map(({ _count, ...ngo }) => ({
      ...ngo,
      teamCount: _count.teamMembers,
      volunteerCount: _count.volunteerApplicants,
    })),
  });
});

router.get("/:id", async (req, res) => {
  const ngo = await prisma.user.findFirst({
    where: { id: req.params.id, ...LISTED_WHERE },
    select: {
      ...PUBLIC_FIELDS,
      teamMembers: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, role: true, photoUrl: true },
      },
      _count: { select: { volunteerApplicants: { where: { status: VolunteerStatus.APPROVED } } } },
    },
  });
  if (!ngo) return res.status(404).json({ error: "NGO not found" });

  // Whether *this* caller already applied, so the app shows "Applied"/"You volunteer here"
  // instead of offering a button that would 409.
  const myApplication = await prisma.volunteerApplication.findUnique({
    where: { ngoId_userId: { ngoId: ngo.id, userId: req.user!.sub } },
    select: { id: true, status: true, rejectionReason: true, createdAt: true },
  });

  const { _count, ...rest } = ngo;
  res.json({ ngo: { ...rest, volunteerCount: _count.volunteerApplicants }, myApplication });
});

const applySchema = z.object({
  message: z.string().trim().max(1000).optional(),
  availability: z.string().trim().max(200).optional(),
  skills: z.string().trim().max(200).optional(),
});

router.post("/:id/volunteer", async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const ngo = await prisma.user.findFirst({ where: { id: req.params.id, ...LISTED_WHERE }, select: { id: true, name: true } });
  if (!ngo) return res.status(404).json({ error: "NGO not found" });
  if (ngo.id === req.user!.sub) {
    return res.status(400).json({ error: "An organisation can't volunteer with itself" });
  }

  const existing = await prisma.volunteerApplication.findUnique({
    where: { ngoId_userId: { ngoId: ngo.id, userId: req.user!.sub } },
  });
  if (existing?.status === VolunteerStatus.APPROVED) {
    return res.status(409).json({ error: "You already volunteer with this organisation." });
  }
  if (existing?.status === VolunteerStatus.PENDING) {
    return res.status(409).json({ error: "Your application is already with them — they'll be in touch." });
  }

  // A previously rejected applicant may try again: reuse the row (the unique constraint requires
  // it) and reset it to PENDING rather than leaving a stale rejection in the NGO's queue.
  const application = await prisma.volunteerApplication.upsert({
    where: { ngoId_userId: { ngoId: ngo.id, userId: req.user!.sub } },
    update: { ...parsed.data, status: VolunteerStatus.PENDING, rejectionReason: null },
    create: { ngoId: ngo.id, userId: req.user!.sub, ...parsed.data },
  });

  notify({
    recipientIds: [ngo.id],
    type: NotificationType.CONTRIBUTION_RECEIVED,
    title: "Someone wants to volunteer",
    body: "A new volunteer application is waiting in your panel.",
  }).catch(() => {});

  res.status(201).json({ application });
});

/** The organisations this user volunteers with — drives the profile badges. */
router.get("/me/memberships", async (req, res) => {
  const applications = await prisma.volunteerApplication.findMany({
    where: { userId: req.user!.sub },
    orderBy: { updatedAt: "desc" },
    include: { ngo: { select: { id: true, name: true, legalName: true, city: true, coverPhotoUrl: true } } },
  });
  res.json({ applications });
});

export default router;
