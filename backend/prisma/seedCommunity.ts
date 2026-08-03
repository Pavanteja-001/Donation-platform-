// Seeds the national helplines shown under "Safety & Emergency Support" in the mobile menu.
//
// These six are the ones on the reference design, and they are the ones a person in trouble is
// most likely to need. They are seeded rather than hardcoded in the app so an admin can correct a
// number without an app-store release (see the Helpline model) — but the platform should never
// ship with an EMPTY safety section, which is what this script prevents.
//
// Idempotent: matched on `number`, so re-running updates the existing row instead of duplicating
// it. Numbers are the stable identity here — a helpline gets renamed far more often than a
// short code changes.
//
//   npx tsx prisma/seedCommunity.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * `iconKey` names a built-in icon the apps already know how to draw, so a seeded helpline looks
 * right before anyone uploads artwork for it. Keep these in sync with HELPLINE_ICONS in
 * mobile/src/lib/helplineIcons.ts.
 */
const HELPLINES = [
  { name: "Mental Health Support", number: "9152987821", category: "Mental health", iconKey: "heart", sortOrder: 1 },
  { name: "Suicide Helpline", number: "9152987822", category: "Crisis support", iconKey: "ribbon", sortOrder: 2 },
  { name: "Women Helpline", number: "181", category: "Women's safety", iconKey: "women", sortOrder: 3 },
  { name: "Child Helpline", number: "1098", category: "Child safety", iconKey: "child", sortOrder: 4 },
  { name: "Police", number: "100", category: "Emergency", iconKey: "shield", sortOrder: 5 },
  { name: "Ambulance", number: "108", category: "Emergency", iconKey: "ambulance", sortOrder: 6 },
];

async function main() {
  for (const helpline of HELPLINES) {
    const existing = await prisma.helpline.findFirst({ where: { number: helpline.number } });
    if (existing) {
      await prisma.helpline.update({ where: { id: existing.id }, data: helpline });
      console.log(`Updated helpline ${helpline.number} — ${helpline.name}`);
    } else {
      await prisma.helpline.create({ data: helpline });
      console.log(`Created helpline ${helpline.number} — ${helpline.name}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
