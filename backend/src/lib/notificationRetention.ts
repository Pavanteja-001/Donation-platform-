import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Ages notifications out of the inbox table.
 *
 * WHY THIS EXISTS: `notify()` writes one row per recipient, so a single emergency blood request in
 * a city writes as many rows as there are eligible donors there. At 5k users that's a couple of
 * hundred; at 100k it's a few thousand — per need. Nothing but a user tapping "clear all" ever
 * deleted a row, so the table grew without bound and would have become the largest thing in the
 * database by an order of magnitude (~14M rows/year at 100k users) while serving no one: nobody
 * scrolls to a notification from eleven months ago.
 */

/**
 * Read rows go first. The user has already seen them; the row's only remaining job is history.
 */
export const READ_RETENTION_DAYS = 60;

/**
 * Unread rows get three times as long, deliberately. An unread emergency blood alert is precisely
 * the row a donor might come back to — deleting it on the same schedule as a read one would erase
 * something they never saw. Time, not attention, is what expires it.
 */
export const UNREAD_RETENTION_DAYS = 180;

/**
 * Rows per DELETE statement.
 *
 * Deliberately not one big `deleteMany` over the whole cutoff: on a multi-million-row table that
 * is a single statement holding locks and writing WAL for minutes, which stalls the inserts that
 * `notify()` is doing at the same time — during an emergency fan-out, the worst possible moment.
 * Small batches keep every individual lock short and let normal traffic interleave.
 */
const BATCH_SIZE = 1_000;

/**
 * Ceiling on how much one run may delete, so a first run against a long-neglected table (or a
 * misconfigured cutoff) can't turn into an hours-long delete storm. Whatever is left over is
 * simply picked up by the next run — the job is incremental by design, never all-or-nothing.
 */
const MAX_BATCHES_PER_RUN = 200;

/**
 * Deletes rows matching `where` in bounded batches. Returns how many actually went.
 *
 * Ids are selected first and then deleted by primary key rather than issuing one `DELETE ... WHERE
 * createdAt < x LIMIT n` — Prisma's `deleteMany` has no LIMIT, and this two-step keeps each delete
 * an indexed primary-key lookup instead of a range scan that re-walks rows the previous batch
 * already handled.
 */
async function purgeInBatches(where: Prisma.NotificationWhereInput): Promise<number> {
  let total = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const rows = await prisma.notification.findMany({
      where,
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    const { count } = await prisma.notification.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    total += count;

    // A short batch means we've reached the end of what matches; no point paying for another
    // round trip to discover the same thing.
    if (rows.length < BATCH_SIZE) break;
  }

  return total;
}

export interface PurgeResult {
  read: number;
  unread: number;
}

/**
 * One retention pass. Safe to run concurrently with live traffic and safe to run twice — a second
 * caller simply finds nothing left to delete, which is what makes it fine on multiple replicas
 * without a distributed lock.
 *
 * `now` is injectable so the cutoff arithmetic can be tested without waiting 180 days.
 */
export async function purgeExpiredNotifications(now: Date = new Date()): Promise<PurgeResult> {
  const dayMs = 24 * 60 * 60 * 1000;
  const readCutoff = new Date(now.getTime() - READ_RETENTION_DAYS * dayMs);
  const unreadCutoff = new Date(now.getTime() - UNREAD_RETENTION_DAYS * dayMs);

  // Aged on `createdAt`, not `readAt`, for both branches. It's the column the retention index
  // covers, it only ever moves forward, and "60 days after it arrived" is easier to reason about
  // (and to explain to a user) than "60 days after you happened to open it".
  const read = await purgeInBatches({ readAt: { not: null }, createdAt: { lt: readCutoff } });
  const unread = await purgeInBatches({ readAt: null, createdAt: { lt: unreadCutoff } });

  return { read, unread };
}
