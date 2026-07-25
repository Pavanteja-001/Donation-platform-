import { z } from "zod";

// PRD §11.2 — GOODS payload. `claimed` is deliberately absent from the *input* schema:
// server-computed only, never accepted from the client — same tamper-guard pattern as MONEY's
// raised_amount / KIT's kits_funded / MEAL_SLOT's slots_confirmed.
export const goodsPayloadInputSchema = z.object({
  item: z.string().min(1),
  condition: z.string().min(1),
});

export interface GoodsPayload {
  item: string;
  condition: string;
  claimed: boolean;
}

const goodsPayloadSchema = goodsPayloadInputSchema.extend({
  claimed: z.boolean(),
});

// Reads a Need's JSON payload as GOODS-shaped, or null if it isn't (defensive — payload is
// untyped JSON at the DB layer).
export function parseGoodsPayload(payload: unknown): GoodsPayload | null {
  const parsed = goodsPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
