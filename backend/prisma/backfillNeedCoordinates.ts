import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * One-off backfill for needs created before the server resolved coordinates.
 *
 * Those rows carry a city/area but no latitude/longitude, so the mobile map used to invent a
 * position for them (a fanned-out offset from a hardcoded Visakhapatnam default). Now that the
 * clients simply don't plot a need without a coordinate, these rows would silently vanish from
 * the map — so give them the same area/district-centre fallback a newly created need gets.
 *
 * Only fills nulls; an existing pin is never overwritten.
 */
async function backfillNeedCoordinates() {
  const needs = await prisma.need.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, city: true, area: true, title: true },
  });

  let filled = 0;
  for (const need of needs) {
    let coords: { latitude: number | null; longitude: number | null } | null = null;

    if (need.area) {
      const area = await prisma.area.findFirst({
        where: {
          name: { equals: need.area, mode: "insensitive" },
          latitude: { not: null },
          longitude: { not: null },
          ...(need.city ? { district: { name: { equals: need.city, mode: "insensitive" } } } : {}),
        },
        select: { latitude: true, longitude: true },
      });
      if (area) coords = area;
    }

    if (!coords && need.city) {
      const district = await prisma.district.findFirst({
        where: {
          name: { equals: need.city, mode: "insensitive" },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { latitude: true, longitude: true },
      });
      if (district) coords = district;
    }

    if (!coords) {
      console.log(`  skipped "${need.title}" — no resolvable location (${need.area ?? "-"}, ${need.city ?? "-"})`);
      continue;
    }

    await prisma.need.update({ where: { id: need.id }, data: coords });
    filled += 1;
    console.log(`  filled "${need.title}" → ${coords.latitude}, ${coords.longitude}`);
  }

  console.log(`Backfill complete: ${filled}/${needs.length} needs given a fallback coordinate.`);
}

backfillNeedCoordinates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
