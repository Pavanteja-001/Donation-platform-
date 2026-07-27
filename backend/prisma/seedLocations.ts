import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// District centres and approximate locality centres.
//
// These are the *fallback* coordinates only: the map shows a need at the pin the poster
// actually dropped (CreateBloodNeedScreen / CreateBloodNeedPage), and this table is what
// centres that picker and what the server falls back to when a need is posted without a
// pin at all (see `resolveNeedCoordinates` in routes/needs.ts).
//
// Area values are locality centres accurate to roughly a kilometre — good enough to open
// the picker on the right neighbourhood, NOT good enough to be treated as the hospital's
// address. An admin can refine any of them from the Locations page (PATCH
// /api/admin/locations/districts/:id and /areas/:id).
type SeedArea = { name: string; lat?: number; lng?: number };

const LOCATION_DATA: { district: string; state?: string; lat: number; lng: number; areas: SeedArea[] }[] = [
  {
    district: "Visakhapatnam",
    lat: 17.6868,
    lng: 83.2185,
    areas: [
      { name: "Gajuwaka", lat: 17.6817, lng: 83.21 },
      { name: "MVP Colony", lat: 17.74, lng: 83.33 },
      { name: "Pendurthi", lat: 17.818, lng: 83.19 },
      { name: "Maharani Peta", lat: 17.705, lng: 83.302 },
      { name: "Siripuram", lat: 17.718, lng: 83.316 },
      { name: "Madhurawada", lat: 17.81, lng: 83.36 },
      { name: "Gopalapatnam", lat: 17.753, lng: 83.216 },
      { name: "Simhachalam", lat: 17.766, lng: 83.25 },
      { name: "Seethammadhara", lat: 17.737, lng: 83.317 },
      { name: "Akkayyapalem", lat: 17.733, lng: 83.296 },
      { name: "Steel Plant Township", lat: 17.64, lng: 83.18 },
      { name: "Dwaraka Nagar", lat: 17.7255, lng: 83.307 },
      { name: "NAD Junction", lat: 17.742, lng: 83.23 },
      { name: "Arilova", lat: 17.762, lng: 83.34 },
      { name: "Rushikonda", lat: 17.783, lng: 83.383 },
    ],
  },
  {
    district: "Vizianagaram",
    lat: 18.1067,
    lng: 83.3956,
    areas: [
      { name: "Cantonment", lat: 18.115, lng: 83.395 },
      { name: "Fort Area", lat: 18.114, lng: 83.403 },
      { name: "Salur", lat: 18.517, lng: 83.205 },
      { name: "Parvathipuram", lat: 18.783, lng: 83.426 },
      { name: "Bobbili", lat: 18.57, lng: 83.36 },
      { name: "Cheepurupalli", lat: 18.308, lng: 83.567 },
      { name: "Nellimarla", lat: 18.167, lng: 83.433 },
      { name: "Kothavalasa", lat: 18.133, lng: 83.2 },
      { name: "Gajapathinagaram", lat: 18.283, lng: 83.333 },
      { name: "Phool Bagh", lat: 18.113, lng: 83.409 },
    ],
  },
  {
    district: "Vijayawada (NTR)",
    lat: 16.5062,
    lng: 80.648,
    areas: [
      { name: "Benz Circle", lat: 16.498, lng: 80.656 },
      { name: "Governorpet", lat: 16.512, lng: 80.63 },
      { name: "Patamata", lat: 16.493, lng: 80.669 },
      { name: "One Town", lat: 16.518, lng: 80.618 },
      { name: "Gannavaram", lat: 16.54, lng: 80.805 },
      { name: "Kanuru", lat: 16.487, lng: 80.69 },
      { name: "Bhavanipuram", lat: 16.508, lng: 80.59 },
      { name: "Satyanarayanapuram", lat: 16.506, lng: 80.618 },
      { name: "Moghalrajpuram", lat: 16.509, lng: 80.64 },
      { name: "Poranki", lat: 16.472, lng: 80.7 },
    ],
  },
  {
    district: "Guntur",
    lat: 16.3067,
    lng: 80.4365,
    areas: [
      { name: "Brodipet", lat: 16.307, lng: 80.44 },
      { name: "Arundelpet", lat: 16.305, lng: 80.436 },
      { name: "Pattabhipuram", lat: 16.3, lng: 80.45 },
      { name: "Amaravati", lat: 16.573, lng: 80.358 },
      { name: "Tenali", lat: 16.243, lng: 80.64 },
      { name: "Narasaraopet", lat: 16.235, lng: 80.049 },
      { name: "Mangalagiri", lat: 16.43, lng: 80.55 },
      { name: "Tadepalle", lat: 16.48, lng: 80.6 },
      { name: "Koritepadu", lat: 16.313, lng: 80.455 },
      { name: "Old Guntur", lat: 16.312, lng: 80.427 },
    ],
  },
  {
    district: "Srikakulam",
    lat: 18.2949,
    lng: 83.8938,
    areas: [
      { name: "Srikakulam Town", lat: 18.297, lng: 83.896 },
      { name: "Amadalavalasa", lat: 18.41, lng: 83.9 },
      { name: "Tekkali", lat: 18.607, lng: 84.234 },
      { name: "Palasa", lat: 18.77, lng: 84.41 },
      { name: "Ichchapuram", lat: 19.117, lng: 84.687 },
      { name: "Narasannapeta", lat: 18.415, lng: 84.045 },
      { name: "Rajam", lat: 18.45, lng: 83.6 },
      { name: "Ponduru", lat: 18.33, lng: 83.75 },
    ],
  },
  {
    district: "Kakinada",
    lat: 16.9891,
    lng: 82.2475,
    areas: [
      { name: "Kakinada Main", lat: 16.96, lng: 82.24 },
      { name: "Bhanugudi", lat: 16.97, lng: 82.238 },
      { name: "Jagannaickpur", lat: 16.94, lng: 82.24 },
      { name: "Samalkot", lat: 17.053, lng: 82.173 },
      { name: "Pithapuram", lat: 17.116, lng: 82.254 },
      { name: "Tuni", lat: 17.35, lng: 82.546 },
      { name: "Peddapuram", lat: 17.078, lng: 82.138 },
      { name: "Gaigolupadu", lat: 16.98, lng: 82.23 },
    ],
  },
  {
    district: "Tirupati",
    lat: 13.6288,
    lng: 79.4192,
    areas: [
      { name: "Tirupati Central", lat: 13.63, lng: 79.419 },
      { name: "Alipiri", lat: 13.648, lng: 79.38 },
      { name: "Renigunta", lat: 13.635, lng: 79.512 },
      { name: "Chandragiri", lat: 13.586, lng: 79.32 },
      { name: "Srikalahasti", lat: 13.75, lng: 79.7 },
      { name: "Pileru", lat: 13.65, lng: 78.947 },
      { name: "Tiruchanoor", lat: 13.61, lng: 79.44 },
      { name: "MR Palle", lat: 13.64, lng: 79.41 },
    ],
  },
];

export async function seedLocations() {
  console.log("Seeding districts and areas...");
  for (const item of LOCATION_DATA) {
    // Coordinates are part of the update path, not just create — re-running the seed after
    // this migration is how existing districts/areas (created before the columns existed)
    // get their centres filled in.
    const district = await prisma.district.upsert({
      where: { name: item.district },
      update: { state: item.state ?? "Andhra Pradesh", latitude: item.lat, longitude: item.lng },
      create: {
        name: item.district,
        state: item.state ?? "Andhra Pradesh",
        latitude: item.lat,
        longitude: item.lng,
      },
    });

    for (const area of item.areas) {
      await prisma.area.upsert({
        where: { districtId_name: { districtId: district.id, name: area.name } },
        update: { latitude: area.lat ?? null, longitude: area.lng ?? null },
        create: {
          name: area.name,
          districtId: district.id,
          latitude: area.lat ?? null,
          longitude: area.lng ?? null,
        },
      });
    }
  }
  console.log("Locations successfully seeded!");
}

if (require.main === module) {
  seedLocations()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
