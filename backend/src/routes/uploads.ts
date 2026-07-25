import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { createUploadUrl } from "../lib/storage";

const router = Router();
router.use(requireAuth);

const signSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  // Keeps the bucket organized and leaves room for different rules per folder later
  // (e.g. contribution proofs stay public; KYC docs will eventually need to be private).
  folder: z.enum(["contribution-proofs", "need-qr"]),
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
