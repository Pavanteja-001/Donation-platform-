import type { Contribution } from "@prisma/client";

// PRD §14.2 — a kind-aware, human-readable summary of what was given. Mirrors the
// formatContributionAmount() already duplicated across all three frontends this build, but
// server-side so the certificate endpoint doesn't need the caller to reconstruct it.
export function summarizeContribution(c: Contribution): string {
  if (c.kind === "MONEY") return `₹${c.amount?.toLocaleString("en-IN")}`;
  if (c.kind === "KIT") return `${c.kits} kit${c.kits === 1 ? "" : "s"}`;
  if (c.kind === "BLOOD") return `${c.units} unit${c.units === 1 ? "" : "s"} of blood`;
  if (c.kind === "MEAL_SLOT") {
    const date = c.mealSlotDate ? c.mealSlotDate.toISOString().slice(0, 10) : "";
    return c.amount != null ? `a meal slot (₹${c.amount.toLocaleString("en-IN")}) on ${date}` : `a meal slot on ${date}`;
  }
  if (c.kind === "GOODS") return "a claimed item";
  if (c.kind === "SKILL_REQUEST") return "a volunteer service pledge";
  return "a contribution";
}

// D-006, verbatim and non-negotiable — never "official," "medical," "government," or
// "tax-deductible," regardless of type or whether a linked institution verified the need.
export const CERTIFICATE_DISCLAIMER =
  "This is a DonationPlatform record of a confirmed contribution — not an official medical, government, or tax-deductible certificate.";
