import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// Public location listing for dropdowns (Districts + Areas).
//
// Areas are objects, not bare names, because every client needs the coordinate alongside the
// label: picking "Rushikonda" has to move the map pin to Rushikonda. Clients used to carry
// their own hardcoded city→coordinate table, which silently fell back to Visakhapatnam for
// anything it didn't recognise (including "Vijayawada (NTR)", whose name never matched the
// key "ntr (vijayawada)") — that's why needs rendered in the wrong place. The DB is now the
// single source of truth for location coordinates.
router.get("/", async (_req, res) => {
  try {
    const districts = await prisma.district.findMany({
      orderBy: { name: "asc" },
      include: {
        areas: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, latitude: true, longitude: true },
        },
      },
    });

    res.json({
      districts: districts.map((d) => ({
        id: d.id,
        name: d.name,
        state: d.state,
        latitude: d.latitude,
        longitude: d.longitude,
        areas: d.areas.map((a) => ({
          id: a.id,
          name: a.name,
          latitude: a.latitude,
          longitude: a.longitude,
        })),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load locations" });
  }
});

export default router;
