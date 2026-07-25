import { z } from "zod";
import { BloodGroup } from "@prisma/client";

// PRD §8.3 — BLOOD payload. `units_fulfilled` is deliberately absent from the *input* schema:
// it's server-computed from confirmed Contributions (§8.5), never accepted from the client —
// same tamper-guard pattern as MONEY's raised_amount / KIT's kits_funded.
export const bloodPayloadInputSchema = z.object({
  blood_group: z.nativeEnum(BloodGroup),
  units_needed: z.number().int().positive(),
});

export interface BloodPayload {
  blood_group: BloodGroup;
  units_needed: number;
  units_fulfilled: number;
}

const bloodPayloadSchema = bloodPayloadInputSchema.extend({
  units_fulfilled: z.number().int().nonnegative(),
});

// Reads a Need's JSON payload as BLOOD-shaped, or null if it isn't (defensive — payload is
// untyped JSON at the DB layer).
export function parseBloodPayload(payload: unknown): BloodPayload | null {
  const parsed = bloodPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
