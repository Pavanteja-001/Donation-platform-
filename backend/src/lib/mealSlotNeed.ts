import { z } from "zod";

// PRD §10.1 — MEAL_SLOT payload. `slots_total`/`slots_confirmed` are deliberately absent from
// the *input* schema: server-computed (10.1/10.4), never accepted from the client — same
// tamper-guard pattern as MONEY's raised_amount / KIT's kits_funded. `dates` is input-only too —
// it drives the MealSlot rows created at submission (§10.2) and isn't part of the stored payload
// itself (the per-date state lives in the MealSlot table, not here).
export const mealSlotPayloadInputSchema = z
  .object({
    meal_type: z.string().min(1),
    cost_per_slot: z.number().int().positive(),
    // Fixed for the need's lifetime once submitted (§10.2) — same reasoning as Kit's mode
    // (D-004): the locking guarantee in §10.3 depends on the bookable date set not shifting.
    mode: z.enum(["MONEY", "DELIVER"]),
    upi_id: z.string().min(1).optional(),
    // One MealSlot row per date (§10.2). Capped so a single need can't spawn an unbounded
    // number of rows; deduplicated defensively even though the DB's (needId, date) unique
    // constraint would also catch it.
    dates: z.array(z.coerce.date()).min(1).max(60),
  })
  .refine((data) => data.mode !== "MONEY" || !!data.upi_id, {
    message: "upi_id is required when mode is MONEY",
    path: ["upi_id"],
  });

export interface MealSlotPayload {
  meal_type: string;
  cost_per_slot: number;
  slots_total: number;
  slots_confirmed: number;
  mode: "MONEY" | "DELIVER";
  upi_id?: string;
}

const mealSlotPayloadSchema = z
  .object({
    meal_type: z.string().min(1),
    cost_per_slot: z.number().int().positive(),
    slots_total: z.number().int().nonnegative(),
    slots_confirmed: z.number().int().nonnegative(),
    mode: z.enum(["MONEY", "DELIVER"]),
    upi_id: z.string().min(1).optional(),
  })
  .refine((data) => data.mode !== "MONEY" || !!data.upi_id, {
    message: "upi_id is required when mode is MONEY",
    path: ["upi_id"],
  });

// Reads a Need's JSON payload as MEAL_SLOT-shaped, or null if it isn't (defensive — payload is
// untyped JSON at the DB layer).
export function parseMealSlotPayload(payload: unknown): MealSlotPayload | null {
  const parsed = mealSlotPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

// De-duplicates by calendar day (time-of-day differences would otherwise slip past the
// (needId, date) unique constraint as "different" dates).
export function dedupeDates(dates: Date[]): Date[] {
  const seen = new Map<string, Date>();
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    if (!seen.has(key)) seen.set(key, new Date(`${key}T00:00:00.000Z`));
  }
  return [...seen.values()];
}
