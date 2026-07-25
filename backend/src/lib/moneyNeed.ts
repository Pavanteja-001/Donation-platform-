import { z } from "zod";

// PRD §7.1 — MONEY payload. `raised_amount` is deliberately absent from the *input* schema:
// it's server-computed from confirmed Contributions (§7.3), never accepted from the client.
export const moneyPayloadInputSchema = z.object({
  target_amount: z.number().int().positive(),
  upi_id: z.string().min(1),
  upi_qr: z.string().url().optional(),
});

export interface MoneyPayload {
  target_amount: number;
  raised_amount: number;
  upi_id: string;
  upi_qr?: string;
}

const moneyPayloadSchema = moneyPayloadInputSchema.extend({
  raised_amount: z.number().int().nonnegative(),
});

// Reads a Need's JSON payload as MONEY-shaped, or null if it isn't (defensive — payload is
// untyped JSON at the DB layer).
export function parseMoneyPayload(payload: unknown): MoneyPayload | null {
  const parsed = moneyPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
