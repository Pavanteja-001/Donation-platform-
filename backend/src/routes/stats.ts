import { Router } from "express";
import { KycStatus, NeedStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { cached, CacheKey, CacheTtl } from "../lib/cache";

const router = Router();
router.use(requireAuth);

/**
 * The home screen's two headline blocks: "Impact at a Glance" and "Present Cases Summary".
 *
 * Every number here is computed from the database — none are seeded, configured or rounded up.
 * On a donation platform the headline figures ARE the trust proposition, so a placeholder that
 * looks impressive is worse than a small honest number: the first donor who reconciles the total
 * against what they can actually see in the feed stops believing anything else on the page.
 *
 * DRAFT needs are excluded from every count. A draft is private to whoever is still writing it,
 * so counting it publicly would inflate "total cases" with requests nobody has even submitted.
 */

/** Start of the current month in IST — the platform is India-only, so month boundaries are too. */
function startOfMonthIST(now: Date = new Date()): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const startIstMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1);
  return new Date(startIstMs - IST_OFFSET_MS);
}

/** Needs a donor can act on right now. */
const OPEN_STATUSES: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED];

router.get("/", async (_req, res) => {
  const payload = await cached(CacheKey.publicStats, CacheTtl.publicStats, async () => {
    const monthStart = startOfMonthIST();

    const [
      confirmedAmount,
      needsFulfilled,
      verifiedInstitutions,
      bloodDonors,
      totalCases,
      activeCases,
      pendingCases,
      completedThisMonth,
    ] = await Promise.all([
      // `amount` is null for BLOOD/GOODS contributions (nothing monetary changed hands), and SUM
      // ignores nulls — so this is the money total without needing a `kind` filter.
      //
      // Console roles are excluded for the same reason they can no longer donate at all (see
      // `blockedAsConsoleRole` in routes/needs.ts): an admin can confirm their own contribution,
      // so admin money is money nobody independent verified. It is not a hypothetical — four
      // admin test rows worth ₹40,08,72,431 were 99.97% of this headline figure, which is exactly
      // the "impressive placeholder" this file's own comment warns against.
      prisma.contribution.aggregate({
        _sum: { amount: true },
        where: { status: "CONFIRMED", donor: { role: { notIn: [Role.ADMIN, Role.STAFF] } } },
      }),
      prisma.need.count({ where: { status: NeedStatus.FULFILLED } }),
      prisma.user.count({ where: { role: Role.INSTITUTION, kycStatus: KycStatus.APPROVED } }),
      // Anyone who has filled in a blood group — that opt-in IS the donor profile (PRD §8.1).
      // Deliberately NOT filtered by `availableToDonate`: someone temporarily unavailable is
      // still a registered donor, and a headline figure that dipped when people toggled a switch
      // would look like the platform was losing donors.
      prisma.user.count({ where: { bloodGroup: { not: null } } }),

      prisma.need.count({ where: { status: { not: NeedStatus.DRAFT } } }),
      prisma.need.count({ where: { status: { in: OPEN_STATUSES } } }),
      prisma.need.count({ where: { status: NeedStatus.PENDING_VERIFICATION } }),
      prisma.need.count({
        where: { status: NeedStatus.FULFILLED, updatedAt: { gte: monthStart } },
      }),
    ]);

    return {
      impact: {
        /** Rupees, confirmed only — a pledge nobody confirmed is not impact. */
        amountRaised: confirmedAmount._sum.amount ?? 0,
        /**
         * Named for what it actually counts. The design labels this "Lives Helped", but one
         * fulfilled need can serve twenty children and another serves one person — there is no
         * beneficiary-count field to support the stronger claim. Keep the label honest.
         */
        needsFulfilled,
        verifiedInstitutions,
        bloodDonors,
      },
      cases: {
        total: totalCases,
        active: activeCases,
        pending: pendingCases,
        completedThisMonth,
      },
    };
  });

  res.json(payload);
});

export default router;
