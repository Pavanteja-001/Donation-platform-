import { z } from "zod";

// PRD §9.1 — KIT payload. `kits_funded` is deliberately absent from the *input* schema: it's
// server-computed from confirmed Contributions (§9.3), never accepted from the client.
// `upi_id` is required when mode=MONEY (the donor has to pay it somewhere, same as a MONEY
// need) and irrelevant for mode=DELIVER, hence the cross-field refinement below rather than a
// plain `.optional()`.
export const kitPayloadInputSchema = z
  .object({
    contents: z.string().min(1),
    cost_per_kit: z.number().int().positive(),
    kits_needed: z.number().int().positive(),
    // Fixed for the need's lifetime once submitted (§9.2) — not editable after that.
    mode: z.enum(["MONEY", "DELIVER"]),
    upi_id: z.string().min(1).optional(),
  })
  .refine((data) => data.mode !== "MONEY" || !!data.upi_id, {
    message: "upi_id is required when mode is MONEY",
    path: ["upi_id"],
  });

export interface KitPayload {
  contents: string;
  cost_per_kit: number;
  kits_needed: number;
  kits_funded: number;
  mode: "MONEY" | "DELIVER";
  upi_id?: string;
}

const kitPayloadSchema = z
  .object({
    contents: z.string().min(1),
    cost_per_kit: z.number().int().positive(),
    kits_needed: z.number().int().positive(),
    kits_funded: z.number().int().nonnegative(),
    mode: z.enum(["MONEY", "DELIVER"]),
    upi_id: z.string().min(1).optional(),
  })
  .refine((data) => data.mode !== "MONEY" || !!data.upi_id, {
    message: "upi_id is required when mode is MONEY",
    path: ["upi_id"],
  });

// Reads a Need's JSON payload as KIT-shaped, or null if it isn't (defensive — payload is
// untyped JSON at the DB layer).
export function parseKitPayload(payload: unknown): KitPayload | null {
  const parsed = kitPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
