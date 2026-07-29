import { Router } from "express";
import { z } from "zod";
import { BookingStatus, InstitutionType, KycStatus, MealType, NotificationType, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { notify } from "../lib/notifications";

const router = Router();
router.use(requireAuth);

/**
 * Orphanage / old-age-home directory and meal sponsorship.
 *
 * Homes do not publish a calendar. Every future date is open by default; a date+meal becomes
 * unavailable only because another donor already booked it, and the database enforces that with
 * a unique constraint rather than a read-then-write check.
 */

/** The public listing shape — deliberately excludes phone, KYC paperwork and bank details. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  legalName: true,
  city: true,
  area: true,
  address: true,
  about: true,
  coverPhotoUrl: true,
  // `kycPhotos` deliberately NOT selected here. Those are registration certificates and ID
  // proofs submitted for admin review — publishing them to every donor browsing the directory
  // would leak the home's private paperwork. The public gallery is its own field.
  galleryPhotos: true,
  childrenCount: true,
  staffCount: true,
  roomsCount: true,
  breakfastCost: true,
  lunchCost: true,
  dinnerCost: true,
  acceptingBookings: true,
} as const;

/**
 * Only APPROVED homes are listed. An unverified institution appearing in a directory that
 * invites people to send it money is the whole reason KYC exists (D-007).
 */
const LISTED_WHERE = {
  role: Role.INSTITUTION,
  institutionType: InstitutionType.ORPHANAGE,
  kycStatus: KycStatus.APPROVED,
};

const listQuerySchema = z.object({ search: z.string().trim().min(1).max(80).optional() });

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
  }
  const search = parsed.data.search;

  const orphanages = await prisma.user.findMany({
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
      // Count only on the listing — the members themselves are a detail-screen concern, and
      // fetching every home's staff to render a directory row would be wasteful.
      _count: { select: { teamMembers: true } },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  res.json({
    orphanages: orphanages.map(({ _count, ...home }) => ({ ...home, teamCount: _count.teamMembers })),
  });
});

router.get("/:id", async (req, res) => {
  const orphanage = await prisma.user.findFirst({
    where: { id: req.params.id, ...LISTED_WHERE },
    select: {
      ...PUBLIC_FIELDS,
      // The people who run the home. Same shape and same ordering as an NGO's team — a donor
      // sponsoring a meal wants to see who they're dealing with just as much as a volunteer does.
      teamMembers: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, role: true, photoUrl: true },
      },
    },
  });
  if (!orphanage) return res.status(404).json({ error: "Home not found" });
  res.json({ orphanage });
});

const availabilityQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * Which date+meal combinations are already taken.
 *
 * Returns nothing but the pairs. A donor browsing the calendar must not learn who booked a slot,
 * for what occasion or for how many people — only that they can't have it. REJECTED and
 * CANCELLED bookings are excluded, so declining a booking releases the date immediately.
 */
router.get("/:id/availability", async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
  }
  const from = parsed.data.from ?? new Date();
  const to = parsed.data.to ?? new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);

  const taken = await prisma.slotBooking.findMany({
    where: {
      orphanageId: req.params.id,
      date: { gte: startOfDay(from), lte: endOfDay(to) },
      status: { in: [BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.CONFIRMED] },
    },
    select: { date: true, mealType: true },
    orderBy: { date: "asc" },
  });

  res.json({ taken: taken.map((t) => ({ date: t.date.toISOString().slice(0, 10), mealType: t.mealType })) });
});

const bookingSchema = z.object({
  date: z.coerce.date(),
  mealType: z.nativeEnum(MealType),
  purpose: z.string().trim().max(120).optional(),
  peopleCount: z.number().int().positive().max(2000).optional(),
});

router.post("/:id/bookings", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const orphanage = await prisma.user.findFirst({
    where: { id: req.params.id, ...LISTED_WHERE },
    select: { id: true, name: true, acceptingBookings: true, breakfastCost: true, lunchCost: true, dinnerCost: true },
  });
  if (!orphanage) return res.status(404).json({ error: "Home not found" });
  if (!orphanage.acceptingBookings) {
    return res.status(409).json({ error: "This home isn't accepting bookings right now." });
  }

  const date = startOfDay(parsed.data.date);
  // A meal in the past can't be cooked. Comparing whole days, so "today" stays bookable.
  if (date < startOfDay(new Date())) {
    return res.status(400).json({ error: "Pick a date from today onwards." });
  }

  const cost =
    parsed.data.mealType === MealType.BREAKFAST
      ? orphanage.breakfastCost
      : parsed.data.mealType === MealType.LUNCH
        ? orphanage.lunchCost
        : orphanage.dinnerCost;
  if (cost == null) {
    return res.status(409).json({ error: "This home doesn't offer that meal for sponsorship." });
  }

  try {
    const booking = await prisma.slotBooking.create({
      data: {
        orphanageId: orphanage.id,
        donorId: req.user!.sub,
        date,
        mealType: parsed.data.mealType,
        purpose: parsed.data.purpose,
        peopleCount: parsed.data.peopleCount,
        // Snapshotted, so a later price change can't alter what this donor agreed to.
        amount: cost,
      },
    });

    notify({
      recipientIds: [orphanage.id],
      type: NotificationType.CONTRIBUTION_RECEIVED,
      title: "A donor wants to sponsor a meal",
      body: `${parsed.data.mealType.toLowerCase()} on ${date.toDateString()} — open the panel to accept or decline.`,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[notify] booking alert failed:", err);
    });

    res.status(201).json({ booking });
  } catch (err) {
    // The unique constraint is what actually prevents a double booking — two donors submitting
    // the same slot at once both pass any prior "is it free?" read, and only one can insert.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Someone just booked that meal. Pick another date or meal." });
    }
    throw err;
  }
});

/** The signed-in donor's own bookings. */
router.get("/me/bookings", async (req, res) => {
  const bookings = await prisma.slotBooking.findMany({
    where: { donorId: req.user!.sub },
    orderBy: { date: "desc" },
    include: { orphanage: { select: { id: true, name: true, city: true, area: true, coverPhotoUrl: true } } },
    take: 100,
  });
  res.json({ bookings });
});

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

export default router;
