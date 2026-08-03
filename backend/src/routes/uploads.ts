import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { createUploadUrl } from "../lib/storage";

const router = Router();
router.use(requireAuth);

const signSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  // Keeps the bucket organized and leaves room for different rules per folder later
  // (e.g. contribution proofs stay public; KYC docs will eventually need to be private).
  // "need-photos" is Need.photos (any type); "need-qr" is a MONEY/KIT need's UPI QR image.
  // "community" holds the admin-curated menu content: helpline icons, success-story photos and
  // event banners. One folder rather than three — they share exactly the same rules (public,
  // admin-written, image-only) and splitting them would only make the bucket harder to read.
  folder: z.enum([
    "contribution-proofs",
    "need-photos",
    "need-qr",
    "kyc-docs",
    "profile-photos",
    "community",
  ]),
});

// Returns a short-lived signed PUT URL (§ storage.ts) — the client uploads the file bytes
// directly to the bucket with this URL, then sends back `publicUrl` as e.g. Contribution.proofUrl.
router.post("/sign", async (req, res) => {
  const parsed = signSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  try {
    const signed = await createUploadUrl(parsed.data);
    res.json(signed);
  } catch (err) {
    res.status(503).json({ error: err instanceof Error ? err.message : "Upload signing is not configured" });
  }
});

export default router;
