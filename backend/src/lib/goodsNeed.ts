import { z } from "zod";

// A GOODS need points in one of two directions:
//
//   REQUEST — "I need a wheelchair."      Someone who has one claims it.
//   OFFER   — "I have a TV going spare."  Someone who wants it claims it.
//
// Both are the same object running the same lifecycle (CLAUDE.md §3), so an offer is
// admin-verified before it goes live exactly like a request is — nobody lists an item to give
// away without a human checking it first. Only the wording and the direction of the handover
// differ, which is presentation, not structure.
export const GoodsDirection = { REQUEST: "REQUEST", OFFER: "OFFER" } as const;
export type GoodsDirection = (typeof GoodsDirection)[keyof typeof GoodsDirection];

// Free text, not an enum. The mobile form offers presets ("Like new", "Working, used"), but rows
// written before those presets existed hold arbitrary strings, and an enum here would make
// `parseGoodsPayload` return null for every one of them — silently breaking live needs. Presets
// are a UI affordance; the store stays permissive.
const conditionSchema = z.string().min(1);

// PRD §11.2 — GOODS payload. `claimed` is deliberately absent from the *input* schema:
// server-computed only, never accepted from the client — same tamper-guard pattern as MONEY's
// raised_amount / KIT's kits_funded / MEAL_SLOT's slots_confirmed.
export const goodsPayloadInputSchema = z.object({
  item: z.string().min(1),
  condition: conditionSchema,
  // Both default rather than being required: every GOODS need written before offers existed is a
  // request of quantity one, and those rows must keep validating unchanged.
  direction: z.nativeEnum(GoodsDirection).default(GoodsDirection.REQUEST),
  quantity: z.number().int().positive().max(999).default(1),
});

export interface GoodsPayload {
  item: string;
  condition: string;
  direction: GoodsDirection;
  quantity: number;
  claimed: boolean;
}

const goodsPayloadSchema = goodsPayloadInputSchema.extend({
  claimed: z.boolean(),
});

// Reads a Need's JSON payload as GOODS-shaped, or null if it isn't (defensive — payload is
// untyped JSON at the DB layer). Defaults on `direction`/`quantity` mean pre-existing rows parse
// as single-quantity requests without a migration.
export function parseGoodsPayload(payload: unknown): GoodsPayload | null {
  const parsed = goodsPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** The direction of a GOODS need, tolerant of any non-GOODS or malformed payload. */
export function goodsDirectionOf(payload: unknown): GoodsDirection | null {
  const parsed = z
    .object({ direction: z.nativeEnum(GoodsDirection).default(GoodsDirection.REQUEST) })
    .safeParse(payload);
  return parsed.success ? parsed.data.direction : null;
}
