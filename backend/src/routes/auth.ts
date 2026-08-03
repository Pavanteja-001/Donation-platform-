import { Router } from "express";
import { z } from "zod";
import { BloodGroup, Gender, Role, InstitutionType, KycStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requestOtp, verifyOtp } from "../lib/otp";
import { signAuthToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { computeEligibility } from "../lib/bloodEligibility";
import { computeTrustTierProgress } from "../lib/trustTier";
import { deleteReplacedObjects } from "../lib/storage";

const router = Router();

const phoneSchema = z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number");

// PRD §14.1 — computed fresh on every read, never stored, same principle as bloodEligibility.
// Any role can accumulate confirmed contributions (Institutions can also donate, PRD §4), so
// this isn't gated to USER.
async function trustTierPayload(userId: string) {
  const confirmedContributionsCount = await prisma.contribution.count({
    where: { donorId: userId, status: "CONFIRMED" },
  });
  // Returns the tier *and* the distance to the next one — thresholds are a server rule, so
  // clients must never hardcode them (see computeTrustTierProgress).
  return computeTrustTierProgress(confirmedContributionsCount);
}

// Roles a new account can self-register as. ADMIN/STAFF accounts are provisioned
// separately (STAFF by an existing ADMIN — see routes/admin.ts; ADMIN via seed script).
const SELF_REGISTERABLE_ROLES = [Role.USER, Role.INSTITUTION] as const;

router.post("/otp/request", async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body?.phone);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid phone" });
  }
  requestOtp(parsed.data);
  const exists = await prisma.user.findUnique({ where: { phone: parsed.data } });
  res.json({ ok: true, registered: !!exists });
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
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: { phone, name, role: role ?? Role.USER },
    });
  } else if (role && user.role === Role.USER && role === Role.INSTITUTION) {
    // Promote user to INSTITUTION if logging in from the institution partner panel (D-007)
    user = await prisma.user.update({
      where: { phone },
      data: { role: Role.INSTITUTION },
    });
  }

  const token = signAuthToken({ sub: user.id, role: user.role, phone: user.phone });
  // Skip DB query for brand new users to optimize signup speed
  const trustPayload = isNewUser
    ? computeTrustTierProgress(0)
    : await trustTierPayload(user.id);

  res.json({ token, user, bloodEligibility: computeEligibility(user), ...trustPayload });
});

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const [user, confirmedContributionsCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.contribution.count({ where: { donorId: userId, status: "CONFIRMED" } }),
  ]);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    user,
    bloodEligibility: computeEligibility(user),
    ...computeTrustTierProgress(confirmedContributionsCount),
  });
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
  email: z.string().email("Enter a valid email address").optional().nullable(),
  city: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  availableToDonate: z.boolean().optional(),
  expoPushToken: z.string().min(1).optional(),
  fcmToken: z.string().min(1).optional(),

  // KYC fields (Chunk 4)
  institutionType: z.nativeEnum(InstitutionType).optional(),
  legalName: z.string().min(1).optional(),
  registrationNumber: z.string().min(1).optional(),
  darpanId: z.string().optional().nullable(),
  address: z.string().min(1).optional(),
  bankAccount: z.string().min(1).optional(),
  kycDocumentUrl: z.string().url("Enter a valid URL").optional(),
  kycPhotos: z.array(z.string()).optional(),
  kycStatus: z.nativeEnum(KycStatus).optional(),

  // Profile photo (any role)
  profilePhotoUrl: z.string().url("Enter a valid URL").optional().nullable(),

  // Public listing content, INSTITUTION only (enforced in the handler below). Every institution
  // type needs these — an NGO's page shows the same about/cover/gallery an orphanage's does —
  // so they live here rather than on the orphanage-specific endpoint, which also owns meal
  // prices and capacity.
  about: z.string().trim().max(2000).optional().nullable(),
  coverPhotoUrl: z.string().url("Enter a valid URL").optional().nullable(),
  galleryPhotos: z.array(z.string().url()).optional(),
});

/** Listing fields a donor account has no business setting — there is no public donor page. */
const INSTITUTION_ONLY_FIELDS = ["about", "coverPhotoUrl", "galleryPhotos"] as const;

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const data = parsed.data;

  // A donor setting `galleryPhotos` would be publishing to a page that doesn't exist; refuse
  // rather than storing content nothing renders.
  const usesInstitutionFields = INSTITUTION_ONLY_FIELDS.some((f) => data[f] !== undefined);
  if (usesInstitutionFields) {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { role: true } });
    if (me?.role !== Role.INSTITUTION) {
      return res.status(403).json({ error: "Only an institution account has a public listing" });
    }
  }

  // Validate KYC details if the institution is submitting for approval
  if (data.kycStatus === KycStatus.PENDING_APPROVAL) {
    const current = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!current) return res.status(404).json({ error: "User not found" });

    const type = data.institutionType ?? current.institutionType;
    const legalName = data.legalName ?? current.legalName;
    const regNo = data.registrationNumber ?? current.registrationNumber;
    const address = data.address ?? current.address;
    const bankAccount = data.bankAccount ?? current.bankAccount;
    const kycDoc = data.kycDocumentUrl ?? current.kycDocumentUrl;
    const darpanId = data.darpanId !== undefined ? data.darpanId : current.darpanId;

    if (!type) return res.status(400).json({ error: "Institution type is required for KYC approval" });
    if (!legalName) return res.status(400).json({ error: "Legal organization name is required" });
    if (!regNo) return res.status(400).json({ error: "Registration number is required" });
    if (!address) return res.status(400).json({ error: "Organization address is required" });
    if (!bankAccount) return res.status(400).json({ error: "Bank account is required" });
    if (!kycDoc) return res.status(400).json({ error: "KYC document certificate is required" });

    if (type === InstitutionType.NGO && !darpanId) {
      return res.status(400).json({ error: "NGOs must provide a valid Darpan ID" });
    }
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.kycStatus === KycStatus.PENDING_APPROVAL) {
    // Automatically promote role to INSTITUTION to ensure they show up in admin's KYC queue (D-007)
    updateData.role = Role.INSTITUTION;
  }

  // Snapshot the image fields first: this endpoint is how a profile photo, an orphanage cover and
  // the public gallery all get replaced, and every replacement used to strand the old file in the
  // bucket forever. Changing your profile picture is the single most repeated write on the
  // platform, so this is where the storage bill actually grows.
  const before = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { profilePhotoUrl: true, coverPhotoUrl: true, galleryPhotos: true },
  });

  const user = await prisma.user.update({ where: { id: req.user!.sub }, data: updateData });

  if (before) {
    deleteReplacedObjects(
      [before.profilePhotoUrl, before.coverPhotoUrl, ...before.galleryPhotos],
      [user.profilePhotoUrl, user.coverPhotoUrl, ...user.galleryPhotos]
    );
  }
  // KYC documents are deliberately NOT cleaned up here. They are the evidence behind an approval
  // decision (D-007) and an admin may need to look at what was actually submitted long after a
  // re-upload — an audit trail is worth more than the few kilobytes it costs.

  res.json({ user });
});

router.get("/kyc", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      kycStatus: true,
      kycRejectionReason: true,
      institutionType: true,
      legalName: true,
      registrationNumber: true,
      darpanId: true,
      address: true,
      bankAccount: true,
      kycDocumentUrl: true,
      kycPhotos: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

export default router;
