import { Router } from "express";
import { z } from "zod";
import { BookingStatus, InstitutionType, NotificationType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { notify } from "../lib/notifications";

const router = Router();
router.use(requireAuth);

/**
 * The home's side of meal sponsorship: its own public profile, and the bookings it receives.
 *
 * Lifecycle: PENDING → ACCEPTED → CONFIRMED, with REJECTED/CANCELLED as terminal exits.
 * Rejecting or cancelling frees the date immediately, because the availability query only counts
 * PENDING/ACCEPTED/CONFIRMED rows.
 */

const profileSchema = z.object({
  about: z.string().trim().max(2000).nullable().optional(),
  childrenCount: z.number().int().min(0).max(10000).nullable().optional(),
  staffCount: z.number().int().min(0).max(10000).nullable().optional(),
  roomsCount: z.number().int().min(0).max(10000).nullable().optional(),
  coverPhotoUrl: z.string().url().nullable().optional(),
  // The whole gallery is sent each save (add/remove/reorder in one PATCH) rather than a
  // per-photo endpoint — simpler to keep the panel's list and the stored order in step.
  // Uncapped: a home should be able to show as much of its work as it wants.
  galleryPhotos: z.array(z.string().url()).optional(),
  // Null clears a price, which is how a home says "we don't offer this meal".
  breakfastCost: z.number().int().min(0).max(1000000).nullable().optional(),
  lunchCost: z.number().int().min(0).max(1000000).nullable().optional(),
  dinnerCost: z.number().int().min(0).max(1000000).nullable().optional(),
  acceptingBookings: z.boolean().optional(),
});

/** The home edits its own listing. Scoped to the caller — there's no id in the path by design. */
router.patch("/profile", async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { role: true, institutionType: true },
  });
  if (!me || me.role !== Role.INSTITUTION || me.institutionType !== InstitutionType.ORPHANAGE) {
    return res.status(403).json({ error: "Only an orphanage or old-age-home account can edit this profile" });
  }

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.sub },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      about: true,
      childrenCount: true,
      staffCount: true,
      roomsCount: true,
      coverPhotoUrl: true,
      galleryPhotos: true,
      breakfastCost: true,
      lunchCost: true,
      dinnerCost: true,
      acceptingBookings: true,
    },
  });
  res.json({ profile: updated });
});

/** Every booking made against this home. Donor contact is included — the home has to host them. */
router.get("/", async (req, res) => {
  const bookings = await prisma.slotBooking.findMany({
    where: { orphanageId: req.user!.sub },
    orderBy: [{ status: "asc" }, { date: "asc" }],
    include: { donor: { select: { id: true, name: true, phone: true } } },
    take: 200,
  });
  res.json({ bookings });
});

async function loadOwnBooking(bookingId: string, orphanageId: string) {
  const booking = await prisma.slotBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.orphanageId !== orphanageId) return null;
  return booking;
}

router.post("/:id/accept", async (req, res) => {
  const booking = await loadOwnBooking(req.params.id, req.user!.sub);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== BookingStatus.PENDING) {
    return res.status(409).json({ error: `This booking is already ${booking.status.toLowerCase()}` });
  }

  const updated = await prisma.slotBooking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.ACCEPTED },
  });

  notify({
    recipientIds: [booking.donorId],
    type: NotificationType.CONTRIBUTION_CONFIRMED,
    title: "Your sponsorship was accepted 🎉",
    body: `The home accepted your ${booking.mealType.toLowerCase()} on ${booking.date.toDateString()}.`,
  }).catch(() => {});

  res.json({ booking: updated });
});

const rejectSchema = z.object({
  // Same rule as D-017 for needs: a rejection always carries a reason the other side can read.
  reason: z.string().trim().min(1, "A reason is required"),
});

router.post("/:id/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const booking = await loadOwnBooking(req.params.id, req.user!.sub);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status === BookingStatus.CONFIRMED) {
    return res.status(409).json({ error: "A confirmed sponsorship can't be rejected" });
  }

  const updated = await prisma.slotBooking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.REJECTED, rejectionReason: parsed.data.reason },
  });

  notify({
    recipientIds: [booking.donorId],
    type: NotificationType.NEED_STATUS,
    title: "Your sponsorship couldn't be accepted",
    body: `${booking.date.toDateString()} — ${parsed.data.reason}`,
  }).catch(() => {});

  // The date is free again the moment this lands: availability ignores REJECTED rows.
  res.json({ booking: updated });
});

/** The home confirms the meal actually happened / the payment arrived. */
router.post("/:id/confirm", async (req, res) => {
  const booking = await loadOwnBooking(req.params.id, req.user!.sub);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== BookingStatus.ACCEPTED) {
    return res.status(409).json({ error: "Only an accepted booking can be confirmed" });
  }

  const updated = await prisma.slotBooking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CONFIRMED },
  });

  notify({
    recipientIds: [booking.donorId],
    type: NotificationType.CONTRIBUTION_CONFIRMED,
    title: "Sponsorship confirmed 🎉",
    body: `Thank you — your ${booking.mealType.toLowerCase()} on ${booking.date.toDateString()} is confirmed.`,
  }).catch(() => {});

  res.json({ booking: updated });
});

export default router;
