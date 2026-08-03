import { Router } from "express";
import { z } from "zod";
import { EventMode, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { cached, CacheKey, CacheTtl, invalidateCommunityCaches } from "../lib/cache";
import { deleteObjects, deleteReplacedObjects } from "../lib/storage";

/**
 * The community panel — the four admin-curated blocks in the mobile menu drawer, plus the one
 * derived one.
 *
 *   Safety & Emergency Support  -> Helpline        (admin CRUD)
 *   Success Stories             -> SuccessStory    (admin CRUD)
 *   Upcoming Events             -> PlatformEvent   (admin CRUD)
 *   Top Supporters              -> derived from confirmed Contributions (no table)
 *
 * Trust & Transparency is deliberately absent: those four claims ("100% transparent", "0%
 * platform fee", …) are statements about how the platform itself works, not content. Putting
 * them in a database would imply an admin can edit them per-deployment, which is exactly the
 * kind of promise that must not be quietly editable.
 *
 * This file exports two routers:
 *   `publicRouter` — authenticated reads for the app (mounted at /api/community)
 *   `adminRouter`  — writes for the admin console (mounted at /api/admin/community)
 */

// =================================================================================================
// Shared shaping
// =================================================================================================

/** How many of each block the drawer shows before "View all". Matches the reference design. */
const MENU_LIMITS = { helplines: 6, stories: 3, supporters: 3, events: 2 } as const;

/** Hard ceiling on any client-supplied `limit`, so a crafted query can't ask for the whole table. */
const MAX_LIMIT = 100;

function parseLimit(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

const helplineSelect = {
  id: true,
  name: true,
  number: true,
  iconUrl: true,
  iconKey: true,
  category: true,
  sortOrder: true,
} as const;

/** Card shape — no `body`. The full write-up is only sent by the detail endpoint. */
const storyCardSelect = {
  id: true,
  title: true,
  summary: true,
  coverImageUrl: true,
  beneficiaryName: true,
  publishedAt: true,
} as const;

const eventCardSelect = {
  id: true,
  title: true,
  eventType: true,
  mode: true,
  location: true,
  startsAt: true,
  endsAt: true,
  iconUrl: true,
  bannerUrl: true,
} as const;

// =================================================================================================
// Loaders — shared between the per-block endpoints and the combined /menu payload
// =================================================================================================

function loadHelplines() {
  return prisma.helpline.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: helplineSelect,
  });
}

function loadStories(limit: number) {
  return prisma.successStory.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    take: limit,
    select: storyCardSelect,
  });
}

/**
 * Events that haven't finished yet, soonest first.
 *
 * Compared against `endsAt` where one exists so a two-day camp doesn't vanish from "Upcoming" on
 * its own opening morning; single-moment events fall back to `startsAt`.
 */
function loadUpcomingEvents(limit: number) {
  const now = new Date();
  return prisma.platformEvent.findMany({
    where: {
      isPublished: true,
      OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }],
    },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: eventCardSelect,
  });
}

function loadPastEvents(limit: number) {
  const now = new Date();
  return prisma.platformEvent.findMany({
    where: {
      isPublished: true,
      OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }],
    },
    orderBy: { startsAt: "desc" },
    take: limit,
    select: eventCardSelect,
  });
}

export interface TopSupporter {
  id: string;
  rank: number;
  name: string;
  profilePhotoUrl: string | null;
  /** Null unless the donor is a publicly available blood donor — see the privacy note below. */
  bloodGroup: string | null;
  totalAmount: number;
  isInstitution: boolean;
}

/**
 * The leaderboard, computed from money that was actually confirmed.
 *
 * Ranked on `amount` only — a BLOOD or GOODS contribution has `amount: null` and so cannot move
 * anyone up this list. That is the intended reading of "top supporters as per donated amount",
 * and it is also the only ranking that can be reconciled against the public contribution records.
 *
 * PRIVACY (CLAUDE.md §7). Blood group is sensitive health data, so it is shown here only for
 * donors who have both filled in a group AND left `availableToDonate` on — i.e. people already
 * presenting themselves as available blood donors on this platform. A donor who switches that
 * toggle off disappears from this field immediately. Nothing else about the donor is exposed:
 * no phone, no city, no need history. Amount and name are already public on each need's
 * contribution list, so this block reveals no more than the feed does.
 */
async function loadTopSupporters(limit: number): Promise<TopSupporter[]> {
  const grouped = await prisma.contribution.groupBy({
    by: ["donorId"],
    where: {
      status: "CONFIRMED",
      amount: { not: null },
      // Platform operators are not supporters. ADMIN/STAFF cannot donate at all any more (see
      // `blockedAsConsoleRole` in routes/needs.ts), but that guard is new — this filter is what
      // keeps historical admin test rows off a public leaderboard, and it means the two can
      // never disagree if someone loosens the guard later.
      donor: { role: { notIn: [Role.ADMIN, Role.STAFF] } },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const donors = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.donorId) } },
    select: {
      id: true,
      name: true,
      legalName: true,
      profilePhotoUrl: true,
      bloodGroup: true,
      availableToDonate: true,
      role: true,
    },
  });
  const byId = new Map(donors.map((d) => [d.id, d]));

  return (
    grouped
      // Drop before ranking, not after: a donor row that no longer resolves (deleted account)
      // would otherwise leave a hole and make the list read 1, 2, 4.
      .flatMap((g) => {
        const donor = byId.get(g.donorId);
        return donor ? [{ donor, total: g._sum.amount ?? 0 }] : [];
      })
      .map(({ donor, total }, index): TopSupporter => {
        const isInstitution = donor.role === Role.INSTITUTION;
        return {
          id: donor.id,
          rank: index + 1,
          // An institution donates under its registered legal name; a person under the name they
          // signed up with. "Supporter" is the fallback rather than "Anonymous" — the row is on a
          // public leaderboard, so implying a deliberate choice to hide would be wrong.
          name: (isInstitution ? donor.legalName || donor.name : donor.name) ?? "Supporter",
          profilePhotoUrl: donor.profilePhotoUrl,
          bloodGroup: donor.availableToDonate ? donor.bloodGroup : null,
          totalAmount: total,
          isInstitution,
        };
      })
  );
}

// =================================================================================================
// Public router — /api/community
// =================================================================================================

export const publicRouter = Router();
publicRouter.use(requireAuth);

/**
 * One request for the whole drawer.
 *
 * The menu opens as a panel over the current screen, so it has no loading screen of its own to
 * hide behind — four parallel round trips on a 3G connection would show four blocks popping in
 * one after another. One cached payload is what makes it feel instant (D-011).
 */
publicRouter.get("/menu", async (_req, res) => {
  const payload = await cached(CacheKey.communityMenu, CacheTtl.community, async () => {
    const [helplines, stories, supporters, events] = await Promise.all([
      loadHelplines(),
      loadStories(MENU_LIMITS.stories),
      loadTopSupporters(MENU_LIMITS.supporters),
      loadUpcomingEvents(MENU_LIMITS.events),
    ]);
    return {
      // The drawer renders the first few and links to the full list; sending all of them (there
      // are a dozen at most) means "View all helplines" opens instantly from cache.
      helplines,
      helplinePreviewCount: MENU_LIMITS.helplines,
      stories,
      supporters,
      events,
    };
  });
  res.json(payload);
});

publicRouter.get("/helplines", async (_req, res) => {
  const payload = await cached(CacheKey.communityHelplines, CacheTtl.community, async () => ({
    helplines: await loadHelplines(),
  }));
  res.json(payload);
});

publicRouter.get("/success-stories", async (req, res) => {
  const limit = parseLimit(req.query.limit, 20);
  const payload = await cached(CacheKey.communityStories(limit), CacheTtl.community, async () => ({
    stories: await loadStories(limit),
  }));
  res.json(payload);
});

publicRouter.get("/success-stories/:id", async (req, res) => {
  const story = await prisma.successStory.findFirst({
    where: { id: req.params.id, isPublished: true },
  });
  if (!story) return res.status(404).json({ error: "Story not found" });
  res.json({ story });
});

publicRouter.get("/top-supporters", async (req, res) => {
  const limit = parseLimit(req.query.limit, 20);
  const payload = await cached(
    CacheKey.communitySupporters(limit),
    CacheTtl.communitySupporters,
    async () => ({ supporters: await loadTopSupporters(limit) })
  );
  res.json(payload);
});

publicRouter.get("/events", async (req, res) => {
  const scope = req.query.scope === "past" ? "past" : "upcoming";
  const limit = parseLimit(req.query.limit, 20);
  const payload = await cached(CacheKey.communityEvents(scope, limit), CacheTtl.community, async () => ({
    events: scope === "past" ? await loadPastEvents(limit) : await loadUpcomingEvents(limit),
  }));
  res.json(payload);
});

publicRouter.get("/events/:id", async (req, res) => {
  const event = await prisma.platformEvent.findFirst({
    where: { id: req.params.id, isPublished: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json({ event });
});

// =================================================================================================
// Admin router — /api/admin/community
// =================================================================================================

export const adminRouter = Router();
// Staff can read the lists (they answer for this content on support calls) but not change them:
// editing what the whole app shows is a settings-grade action, and D-018 reserves those for ADMIN.
adminRouter.use(requireAuth, requireRole(Role.ADMIN, Role.STAFF));
const adminOnly = requireRole(Role.ADMIN);

/**
 * Every optional text field here is `.nullish()` — accepting `null` as well as an omitted key.
 *
 * A form that clears a field has three honest ways to say so, and the console uses two of them:
 * `""` from an untouched input, and `null` from `value.trim() || null`. Accepting only `undefined`
 * rejected the second with "Expected string, received null" — which surfaced as a save failure on
 * a form where nothing was actually wrong.
 */
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const optionalUrl = z.string().trim().url("Must be a valid URL").or(z.literal("")).nullish();

/**
 * Normalises all three "no value" spellings to one.
 *
 *   undefined -> undefined  (key absent: leave the column alone — this is what makes PATCH partial)
 *   null / "" -> null       (explicitly cleared: unset the column)
 *   text      -> trimmed text
 */
function nullIfBlank(value: string | undefined | null): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

// --- Helplines -----------------------------------------------------------------------------------

const helplineBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  number: z.string().trim().min(3, "Number is required").max(30),
  iconUrl: optionalUrl,
  iconKey: optionalText(40),
  category: optionalText(60),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

adminRouter.get("/helplines", async (_req, res) => {
  const helplines = await prisma.helpline.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ helplines });
});

adminRouter.post("/helplines", adminOnly, async (req, res) => {
  const parsed = helplineBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const helpline = await prisma.helpline.create({
    data: {
      name: parsed.data.name,
      number: parsed.data.number,
      iconUrl: nullIfBlank(parsed.data.iconUrl) ?? null,
      iconKey: nullIfBlank(parsed.data.iconKey) ?? null,
      category: nullIfBlank(parsed.data.category) ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
      isActive: parsed.data.isActive ?? true,
    },
  });
  invalidateCommunityCaches();
  res.status(201).json({ helpline });
});

adminRouter.patch("/helplines/:id", adminOnly, async (req, res) => {
  const parsed = helplineBody.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  // Read first so the old icon can be cleaned up if this edit replaces or clears it — an admin
  // swapping artwork four times should not leave three dead files in the bucket.
  const before = await prisma.helpline.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Helpline not found" });
  try {
    const helpline = await prisma.helpline.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name,
        number: parsed.data.number,
        iconUrl: nullIfBlank(parsed.data.iconUrl),
        iconKey: nullIfBlank(parsed.data.iconKey),
        category: nullIfBlank(parsed.data.category),
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
      },
    });
    deleteReplacedObjects([before.iconUrl], [helpline.iconUrl]);
    invalidateCommunityCaches();
    res.json({ helpline });
  } catch {
    res.status(404).json({ error: "Helpline not found" });
  }
});

adminRouter.delete("/helplines/:id", adminOnly, async (req, res) => {
  try {
    const removed = await prisma.helpline.delete({ where: { id: req.params.id } });
    void deleteObjects([removed.iconUrl]);
    invalidateCommunityCaches();
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Helpline not found" });
  }
});

// --- Success stories -----------------------------------------------------------------------------

const storyBody = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  summary: z.string().trim().min(1, "Summary is required").max(280),
  body: z.string().trim().min(1, "Story text is required").max(20000),
  coverImageUrl: optionalUrl,
  images: z.array(z.string().url()).max(10).nullish(),
  beneficiaryName: optionalText(80),
  relatedNeedId: optionalText(40),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

adminRouter.get("/success-stories", async (_req, res) => {
  const stories = await prisma.successStory.findMany({
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
  });
  res.json({ stories });
});

adminRouter.post("/success-stories", adminOnly, async (req, res) => {
  const parsed = storyBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const relatedNeedId = nullIfBlank(parsed.data.relatedNeedId) ?? null;
  if (relatedNeedId) {
    const exists = await prisma.need.findUnique({ where: { id: relatedNeedId }, select: { id: true } });
    if (!exists) return res.status(400).json({ error: "Linked need not found" });
  }
  const story = await prisma.successStory.create({
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary,
      body: parsed.data.body,
      coverImageUrl: nullIfBlank(parsed.data.coverImageUrl) ?? null,
      images: parsed.data.images ?? [],
      beneficiaryName: nullIfBlank(parsed.data.beneficiaryName) ?? null,
      relatedNeedId,
      isPublished: parsed.data.isPublished ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  invalidateCommunityCaches();
  res.status(201).json({ story });
});

adminRouter.patch("/success-stories/:id", adminOnly, async (req, res) => {
  const parsed = storyBody.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const relatedNeedId = nullIfBlank(parsed.data.relatedNeedId);
  if (relatedNeedId) {
    const exists = await prisma.need.findUnique({ where: { id: relatedNeedId }, select: { id: true } });
    if (!exists) return res.status(400).json({ error: "Linked need not found" });
  }
  const before = await prisma.successStory.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Story not found" });
  try {
    const story = await prisma.successStory.update({
      where: { id: req.params.id },
      data: {
        title: parsed.data.title,
        summary: parsed.data.summary,
        body: parsed.data.body,
        coverImageUrl: nullIfBlank(parsed.data.coverImageUrl),
        // A String[] column has no null: "no photos" is the empty array, and an absent key means
        // leave the existing photos alone.
        images: parsed.data.images === null ? [] : parsed.data.images,
        beneficiaryName: nullIfBlank(parsed.data.beneficiaryName),
        relatedNeedId,
        isPublished: parsed.data.isPublished,
        sortOrder: parsed.data.sortOrder,
      },
    });
    // Covers both a swapped cover and a photo removed from the gallery — the admin form deletes
    // gallery entries by sending a shorter `images` array, which would otherwise leak every
    // photo ever removed from a story.
    deleteReplacedObjects(
      [before.coverImageUrl, ...before.images],
      [story.coverImageUrl, ...story.images]
    );
    invalidateCommunityCaches();
    res.json({ story });
  } catch {
    res.status(404).json({ error: "Story not found" });
  }
});

adminRouter.delete("/success-stories/:id", adminOnly, async (req, res) => {
  try {
    const removed = await prisma.successStory.delete({ where: { id: req.params.id } });
    void deleteObjects([removed.coverImageUrl, ...removed.images]);
    invalidateCommunityCaches();
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Story not found" });
  }
});

// --- Events ---------------------------------------------------------------------------------------

const eventBody = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(20000),
  eventType: optionalText(40),
  mode: z.nativeEnum(EventMode).optional(),
  location: optionalText(120),
  address: optionalText(300),
  startsAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  endsAt: z.string().datetime({ offset: true }).or(z.string().datetime()).or(z.literal("")).nullish(),
  bannerUrl: optionalUrl,
  iconUrl: optionalUrl,
  registrationUrl: optionalUrl,
  contactPhone: optionalText(20),
  isPublished: z.boolean().optional(),
});

/** `endsAt` before `startsAt` would make the event both upcoming and past depending on the query. */
function assertEventDates(startsAt?: string, endsAt?: string | null): string | null {
  if (!startsAt || !endsAt) return null;
  return new Date(endsAt) < new Date(startsAt) ? "End time cannot be before the start time" : null;
}

adminRouter.get("/events", async (_req, res) => {
  const events = await prisma.platformEvent.findMany({ orderBy: { startsAt: "desc" } });
  res.json({ events });
});

adminRouter.post("/events", adminOnly, async (req, res) => {
  const parsed = eventBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const endsAt = nullIfBlank(parsed.data.endsAt) ?? null;
  const dateError = assertEventDates(parsed.data.startsAt, endsAt);
  if (dateError) return res.status(400).json({ error: dateError });

  const event = await prisma.platformEvent.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      eventType: nullIfBlank(parsed.data.eventType) ?? null,
      mode: parsed.data.mode ?? EventMode.OFFLINE,
      location: nullIfBlank(parsed.data.location) ?? null,
      address: nullIfBlank(parsed.data.address) ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      bannerUrl: nullIfBlank(parsed.data.bannerUrl) ?? null,
      iconUrl: nullIfBlank(parsed.data.iconUrl) ?? null,
      registrationUrl: nullIfBlank(parsed.data.registrationUrl) ?? null,
      contactPhone: nullIfBlank(parsed.data.contactPhone) ?? null,
      isPublished: parsed.data.isPublished ?? true,
    },
  });
  invalidateCommunityCaches();
  res.status(201).json({ event });
});

adminRouter.patch("/events/:id", adminOnly, async (req, res) => {
  const parsed = eventBody.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const existing = await prisma.platformEvent.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Event not found" });

  const endsAt = nullIfBlank(parsed.data.endsAt);
  const effectiveStart = parsed.data.startsAt ?? existing.startsAt.toISOString();
  const effectiveEnd = endsAt === undefined ? existing.endsAt?.toISOString() ?? null : endsAt;
  const dateError = assertEventDates(effectiveStart, effectiveEnd);
  if (dateError) return res.status(400).json({ error: dateError });

  const event = await prisma.platformEvent.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      eventType: nullIfBlank(parsed.data.eventType),
      mode: parsed.data.mode,
      location: nullIfBlank(parsed.data.location),
      address: nullIfBlank(parsed.data.address),
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: endsAt === undefined ? undefined : endsAt ? new Date(endsAt) : null,
      bannerUrl: nullIfBlank(parsed.data.bannerUrl),
      iconUrl: nullIfBlank(parsed.data.iconUrl),
      registrationUrl: nullIfBlank(parsed.data.registrationUrl),
      contactPhone: nullIfBlank(parsed.data.contactPhone),
      isPublished: parsed.data.isPublished,
    },
  });
  deleteReplacedObjects([existing.bannerUrl, existing.iconUrl], [event.bannerUrl, event.iconUrl]);
  invalidateCommunityCaches();
  res.json({ event });
});

adminRouter.delete("/events/:id", adminOnly, async (req, res) => {
  try {
    const removed = await prisma.platformEvent.delete({ where: { id: req.params.id } });
    // `registrationUrl` is deliberately not in this list — it points at someone else's form, not
    // at our bucket. `keyFromPublicUrl` would reject it anyway; not passing it says why.
    void deleteObjects([removed.bannerUrl, removed.iconUrl]);
    invalidateCommunityCaches();
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Event not found" });
  }
});
