import { Router } from "express";
import { prisma } from "../lib/prisma";
import { cached, CacheKey, CacheTtl } from "../lib/cache";

const router = Router();

// Public location listing for dropdowns (Districts + Areas).
//
// Areas are objects, not bare names, because every client needs the coordinate alongside the
// label: picking "Rushikonda" has to move the map pin to Rushikonda. Clients used to carry
// their own hardcoded city→coordinate table, which silently fell back to Visakhapatnam for
// anything it didn't recognise (including "Vijayawada (NTR)", whose name never matched the
// key "ntr (vijayawada)") — that's why needs rendered in the wrong place. The DB is now the
// single source of truth for location coordinates.
// Cached for an hour (see lib/cache.ts). This is the single best caching candidate in the API:
// it's read on every app launch, on registration and on every create-need form, it's identical
// for every user, and it only changes when an admin edits a district/area — which invalidates
// this key explicitly, so the hour-long TTL never shows stale data in practice.
router.get("/", async (_req, res) => {
  try {
    const payload = await cached(CacheKey.locations, CacheTtl.locations, async () => {
      const districts = await prisma.district.findMany({
        orderBy: { name: "asc" },
        include: {
          areas: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      });

      return {
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
      };
    });

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: "Failed to load locations" });
  }
});

export default router;
