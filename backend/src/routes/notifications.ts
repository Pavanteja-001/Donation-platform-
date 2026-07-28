import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

/**
 * The notification inbox.
 *
 * Every route here is scoped to `req.user.sub` in the WHERE clause rather than looked up and then
 * checked — a notification carries who donated, which hospital, which blood group, so reading
 * someone else's inbox would be a privacy breach. Scoping in the query makes that impossible by
 * construction instead of by remembering to add a guard.
 */

const listQuerySchema = z.object({
  /** Cursor pagination: pass the id of the last row you have. */
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
  }
  const take = parsed.data.limit ?? 30;

  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: take + 1, // one extra row is how we know whether another page exists
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > take;
  const page = hasMore ? notifications.slice(0, take) : notifications;

  const unreadCount = await prisma.notification.count({
    where: { recipientId: req.user!.sub, readAt: null },
  });

  res.json({
    notifications: page,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    unreadCount,
  });
});

/** Cheap poll for the tab badge — deliberately separate from the list. */
router.get("/unread-count", async (req, res) => {
  const unreadCount = await prisma.notification.count({
    where: { recipientId: req.user!.sub, readAt: null },
  });
  res.json({ unreadCount });
});

router.post("/read-all", async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { recipientId: req.user!.sub, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ updated: result.count });
});

router.post("/:id/read", async (req, res) => {
  // updateMany (not update) so the recipient scope is part of the WHERE — `update` would need a
  // separate ownership check, and a missed one leaks another user's row.
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, recipientId: req.user!.sub },
    data: { readAt: new Date() },
  });
  if (result.count === 0) return res.status(404).json({ error: "Notification not found" });
  res.status(204).send();
});

router.delete("/:id", async (req, res) => {
  const result = await prisma.notification.deleteMany({
    where: { id: req.params.id, recipientId: req.user!.sub },
  });
  if (result.count === 0) return res.status(404).json({ error: "Notification not found" });
  res.status(204).send();
});

/** "Clear all" — the user's own inbox only. */
router.delete("/", async (req, res) => {
  const result = await prisma.notification.deleteMany({ where: { recipientId: req.user!.sub } });
  res.json({ deleted: result.count });
});

export default router;
