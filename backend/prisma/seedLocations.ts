import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOCATION_DATA: { district: string; state?: string; areas: string[] }[] = [
  {
    district: "Visakhapatnam",
    areas: [
      "Gajuwaka",
      "MVP Colony",
      "Pendurthi",
      "Maharani Peta",
      "Siripuram",
      "Madhurawada",
      "Gopalapatnam",
      "Simhachalam",
      "Seethammadhara",
      "Akkayyapalem",
      "Steel Plant Township",
      "Dwaraka Nagar",
      "NAD Junction",
      "Arilova",
      "Rushikonda",
    ],
  },
  {
    district: "Vizianagaram",
    areas: [
      "Cantonment",
      "Fort Area",
      "Salur",
      "Parvathipuram",
      "Bobbili",
      "Cheepurupalli",
      "Nellimarla",
      "Kothavalasa",
      "Gajapathinagaram",
      "Phool Bagh",
    ],
  },
  {
    district: "Vijayawada (NTR)",
    areas: [
      "Benz Circle",
      "Governorpet",
      "Patamata",
      "One Town",
      "Gannavaram",
      "Kanuru",
      "Bhavanipuram",
      "Satyanarayanapuram",
      "Moghalrajpuram",
      "Poranki",
    ],
  },
  {
    district: "Guntur",
    areas: [
      "Brodipet",
      "Arundelpet",
      "Pattabhipuram",
      "Amaravati",
      "Tenali",
      "Narasaraopet",
      "Mangalagiri",
      "Tadepalle",
      "Koritepadu",
      "Old Guntur",
    ],
  },
  {
    district: "Srikakulam",
    areas: [
      "Srikakulam Town",
      "Amadalavalasa",
      "Tekkali",
      "Palasa",
      "Ichchapuram",
      "Narasannapeta",
      "Rajam",
      "Ponduru",
    ],
  },
  {
    district: "Kakinada",
    areas: [
      "Kakinada Main",
      "Bhanugudi",
      "Jagannaickpur",
      "Samalkot",
      "Pithapuram",
      "Tuni",
      "Peddapuram",
      "Gaigolupadu",
    ],
  },
  {
    district: "Tirupati",
    areas: [
      "Tirupati Central",
      "Alipiri",
      "Renigunta",
      "Chandragiri",
      "Srikalahasti",
      "Pileru",
      "Tiruchanoor",
      "MR Palle",
    ],
  },
];

export async function seedLocations() {
  console.log("Seeding districts and areas...");
  for (const item of LOCATION_DATA) {
    const district = await prisma.district.upsert({
      where: { name: item.district },
      update: { state: item.state ?? "Andhra Pradesh" },
      create: { name: item.district, state: item.state ?? "Andhra Pradesh" },
    });

    for (const areaName of item.areas) {
      await prisma.area.upsert({
        where: { districtId_name: { districtId: district.id, name: areaName } },
        update: {},
        create: { name: areaName, districtId: district.id },
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
