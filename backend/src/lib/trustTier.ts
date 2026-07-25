// PRD §14.1 — computed, never stored, same tamper-guard principle as every progress field in
// this codebase. Thresholds are a v1 placeholder, deliberately isolated here so product can tune
// them without touching the schema or any call site.
export type TrustTier = "BRONZE" | "SILVER" | "GOLD";

const SILVER_THRESHOLD = 5;
const GOLD_THRESHOLD = 15;

export function computeTrustTier(confirmedContributionsCount: number): TrustTier {
  if (confirmedContributionsCount >= GOLD_THRESHOLD) return "GOLD";
  if (confirmedContributionsCount >= SILVER_THRESHOLD) return "SILVER";
  return "BRONZE";
}
