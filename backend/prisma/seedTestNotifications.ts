import { NotificationType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Fills the notification inbox with one example of each type, for UI testing only.
 *
 * Scoped deliberately to two accounts — the connected device and the founding admin — so no real
 * user gets test alerts. Re-runnable: it clears anything it previously wrote (matched by the
 * marker below) before inserting, so running it twice doesn't stack duplicates.
 *
 * Remove everything it created with:  npx tsx prisma/seedTestNotifications.ts --clear
 */
const DEVICE_PHONE = "+911234567890";
const ADMIN_PHONE = "+910000000000";

/** Invisible-ish marker so cleanup can find exactly these rows and nothing else. */
const MARKER = "[test]";

async function main() {
  const clearOnly = process.argv.includes("--clear");

  const [device, admin] = await Promise.all([
    prisma.user.findUnique({ where: { phone: DEVICE_PHONE }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { phone: ADMIN_PHONE }, select: { id: true, name: true } }),
  ]);

  if (!device) throw new Error(`No account for ${DEVICE_PHONE}`);
  if (!admin) throw new Error(`No account for ${ADMIN_PHONE}`);

  const removed = await prisma.notification.deleteMany({
    where: { recipientId: { in: [device.id, admin.id] }, body: { contains: MARKER } },
  });
  if (removed.count > 0) console.log(`Cleared ${removed.count} previous test notification(s).`);
  if (clearOnly) return;

  // Link to real needs so tapping a row deep-links somewhere that actually exists.
  const needs = await prisma.need.findMany({ select: { id: true, title: true, type: true }, take: 5 });
  const bloodNeed = needs.find((n) => n.type === "BLOOD") ?? needs[0] ?? null;
  const anyNeed = needs[0] ?? null;

  const deviceRows = [
    {
      type: NotificationType.BLOOD_REQUEST,
      title: "🚨 Emergency blood request nearby",
      body: `B+ needed at Bhanugudi, Kakinada — 2 units. ${MARKER}`,
      needId: bloodNeed?.id ?? null,
    },
    {
      type: NotificationType.CONTRIBUTION_RECEIVED,
      title: "🩸 A donor can give blood",
      body: `Someone has offered B+ blood for your request. Open the app to see their details and call them. ${MARKER}`,
      needId: bloodNeed?.id ?? null,
    },
    {
      type: NotificationType.CONTRIBUTION_CONFIRMED,
      title: "Contribution confirmed 🎉",
      body: `Your contribution for "${anyNeed?.title ?? "a need"}" has been confirmed. Thank you for helping. ${MARKER}`,
      needId: anyNeed?.id ?? null,
    },
    {
      type: NotificationType.NEED_STATUS,
      title: "Your request is now live",
      body: `An admin verified your request — donors can see it in the feed. ${MARKER}`,
      needId: anyNeed?.id ?? null,
    },
    {
      type: NotificationType.FORUM_ANSWER,
      title: "New answer to your question 💬",
      body: `A community member answered: "How long after donating can I donate again?" ${MARKER}`,
      needId: null,
    },
  ];

  const adminRows = [
    {
      type: NotificationType.VERIFICATION_QUEUE,
      title: "New request awaiting verification",
      body: `BLOOD — "B+ urgently needed" in Kakinada is in the queue. ${MARKER}`,
      needId: bloodNeed?.id ?? null,
    },
    {
      type: NotificationType.VERIFICATION_QUEUE,
      title: "New request awaiting verification",
      body: `MONEY — "Support for surgery" in Guntur is in the queue. ${MARKER}`,
      needId: anyNeed?.id ?? null,
    },
    {
      type: NotificationType.CONTRIBUTION_RECEIVED,
      title: "A donation has arrived",
      body: `Someone contributed to a need you posted. Check the payment and confirm it. ${MARKER}`,
      needId: anyNeed?.id ?? null,
    },
  ];

  // Spread createdAt over the last few hours so the list shows a realistic range of "x ago"
  // values rather than five rows all saying "just now".
  const now = Date.now();
  const spread = (rows: typeof deviceRows, recipientId: string) =>
    rows.map((r, i) => ({
      ...r,
      recipientId,
      createdAt: new Date(now - i * 47 * 60 * 1000),
      // Leave the newest two unread so the badge and unread styling are both visible.
      readAt: i < 2 ? null : new Date(now - i * 30 * 60 * 1000),
    }));

  const created = await prisma.notification.createMany({
    data: [...spread(deviceRows, device.id), ...spread(adminRows, admin.id)],
  });

  console.log(`Created ${created.count} test notifications:`);
  console.log(`  ${deviceRows.length} for the device account (${DEVICE_PHONE}) — 2 unread`);
  console.log(`  ${adminRows.length} for the admin (${ADMIN_PHONE}) — 2 unread`);
  console.log(`\nClear them with: npx tsx prisma/seedTestNotifications.ts --clear`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
