// Seeds the first ADMIN account. ADMIN accounts aren't self-registerable (see routes/auth.ts) —
// this script is the only way to create the initial one; that admin can then create STAFF via
// POST /api/admin/staff.
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phone = process.env.SEED_ADMIN_PHONE ?? "+910000000000";
  const admin = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone, name: "Founding Admin", role: Role.ADMIN },
  });
  console.log(`Seeded admin: ${admin.phone} (id ${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
