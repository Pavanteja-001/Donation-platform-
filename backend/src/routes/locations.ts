import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// Public location listing for dropdowns (Districts + Areas)
router.get("/", async (_req, res) => {
  try {
    const districts = await prisma.district.findMany({
      orderBy: { name: "asc" },
      include: {
        areas: {
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      districts: districts.map((d) => ({
        id: d.id,
        name: d.name,
        state: d.state,
        areas: d.areas.map((a) => a.name),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load locations" });
  }
});

export default router;
