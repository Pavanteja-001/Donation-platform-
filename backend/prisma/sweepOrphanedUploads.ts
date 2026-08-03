/**
 * Finds files in the bucket that no database row points at, and (optionally) deletes them.
 *
 * WHY THIS EXISTS. The request paths now clean up after themselves — deleting a need, a story or
 * an event removes its images, and replacing an image removes the one it replaced. Two kinds of
 * orphan survive that:
 *
 *   1. Everything uploaded before those guards existed. Nothing had ever deleted a bucket object,
 *      so every image from every deleted need and every replaced profile photo is still there.
 *   2. Uploads that were never saved. A client asks for a signed URL, PUTs the file, and *then*
 *      the form fails validation or the user closes the tab. The file exists; no row references
 *      it; nothing in a request path can know. This happens routinely — it happened during the
 *      session that built the community panel.
 *
 * SAFETY. Dry-run by default: it prints what it would remove and exits. Deletion needs `--delete`.
 * Objects newer than `--min-age-days` (default 7) are never touched no matter what, because
 * "no row points at it" is indistinguishable from "the form is still open in another tab" —
 * without that window this script would race real users and delete their in-progress uploads.
 *
 *   npx tsx prisma/sweepOrphanedUploads.ts                     # report only
 *   npx tsx prisma/sweepOrphanedUploads.ts --delete            # actually remove them
 *   npx tsx prisma/sweepOrphanedUploads.ts --min-age-days=30   # be more conservative
 */
import { PrismaClient } from "@prisma/client";
import { deleteKeys, keyFromPublicUrl, listAllObjects } from "../src/lib/storage";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const shouldDelete = args.includes("--delete");
const minAgeDays = Number(args.find((a) => a.startsWith("--min-age-days="))?.split("=")[1] ?? 7);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Every bucket URL any row currently points at.
 *
 * MUST list every URL-bearing column in the schema. A column missed here reads as "nothing
 * references this file", and with `--delete` that means deleting a live image — so when a new
 * image field is added to the schema, it has to be added here in the same change.
 */
async function referencedKeys(): Promise<Set<string>> {
  const urls: (string | null)[] = [];

  const users = await prisma.user.findMany({
    select: {
      profilePhotoUrl: true,
      coverPhotoUrl: true,
      galleryPhotos: true,
      kycDocumentUrl: true,
      kycPhotos: true,
    },
  });
  for (const u of users) {
    urls.push(u.profilePhotoUrl, u.coverPhotoUrl, u.kycDocumentUrl, ...u.galleryPhotos, ...u.kycPhotos);
  }

  const needs = await prisma.need.findMany({ select: { photos: true, payload: true } });
  for (const n of needs) {
    urls.push(...n.photos);
    // MONEY/KIT keep their UPI QR inside the JSON payload rather than in a column.
    const payload = n.payload as Record<string, unknown> | null;
    if (payload && typeof payload.upi_qr === "string") urls.push(payload.upi_qr);
  }

  const contributions = await prisma.contribution.findMany({ select: { proofUrl: true } });
  for (const c of contributions) urls.push(c.proofUrl);

  const bookings = await prisma.slotBooking.findMany({ select: { proofUrl: true } });
  for (const b of bookings) urls.push(b.proofUrl);

  // Team member headshots on an institution's public profile.
  const teamMembers = await prisma.teamMember.findMany({ select: { photoUrl: true } });
  for (const t of teamMembers) urls.push(t.photoUrl);

  const stories = await prisma.successStory.findMany({ select: { coverImageUrl: true, images: true } });
  for (const s of stories) urls.push(s.coverImageUrl, ...s.images);

  const events = await prisma.platformEvent.findMany({ select: { bannerUrl: true, iconUrl: true } });
  for (const e of events) urls.push(e.bannerUrl, e.iconUrl);

  const helplines = await prisma.helpline.findMany({ select: { iconUrl: true } });
  for (const h of helplines) urls.push(h.iconUrl);

  const keys = new Set<string>();
  for (const url of urls) {
    const key = keyFromPublicUrl(url);
    if (key) keys.add(key);
  }
  return keys;
}

async function main() {
  console.log(`Mode: ${shouldDelete ? "DELETE" : "dry run (pass --delete to remove)"}`);
  console.log(`Ignoring anything uploaded in the last ${minAgeDays} day(s).\n`);

  const [objects, referenced] = await Promise.all([listAllObjects(), referencedKeys()]);
  const cutoff = new Date(Date.now() - minAgeDays * 24 * 60 * 60 * 1000);

  const orphans = objects.filter((o) => !referenced.has(o.key));
  const tooNew = orphans.filter((o) => !o.lastModified || o.lastModified > cutoff);
  const removable = orphans.filter((o) => o.lastModified && o.lastModified <= cutoff);

  const totalBytes = objects.reduce((sum, o) => sum + o.size, 0);
  const orphanBytes = removable.reduce((sum, o) => sum + o.size, 0);

  console.log(`Bucket:      ${objects.length} objects, ${formatBytes(totalBytes)}`);
  console.log(`Referenced:  ${referenced.size} keys`);
  console.log(`Orphaned:    ${orphans.length} (${tooNew.length} too recent to touch)`);
  console.log(`Removable:   ${removable.length} objects, ${formatBytes(orphanBytes)}\n`);

  // Grouped by folder — a spike in one folder says which flow is leaking, which is far more
  // useful than a flat list of UUIDs.
  const byFolder = new Map<string, { count: number; bytes: number }>();
  for (const o of removable) {
    const folder = o.key.split("/")[0] ?? "(root)";
    const entry = byFolder.get(folder) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += o.size;
    byFolder.set(folder, entry);
  }
  for (const [folder, { count, bytes }] of [...byFolder].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${folder.padEnd(20)} ${String(count).padStart(5)} objects  ${formatBytes(bytes)}`);
  }

  if (removable.length === 0) {
    console.log("\nNothing to remove.");
    return;
  }

  if (!shouldDelete) {
    console.log("\nSample of what would be removed:");
    for (const o of removable.slice(0, 15)) {
      console.log(`  ${o.key}  ${formatBytes(o.size)}  ${o.lastModified?.toISOString().slice(0, 10)}`);
    }
    if (removable.length > 15) console.log(`  … and ${removable.length - 15} more`);
    console.log("\nRe-run with --delete to remove them.");
    return;
  }

  const deleted = await deleteKeys(removable.map((o) => o.key));
  console.log(`\nDeleted ${deleted} objects, freeing ${formatBytes(orphanBytes)}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
