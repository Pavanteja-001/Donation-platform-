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

export interface TrustTierProgress {
  trustTier: TrustTier;
  confirmedContributionsCount: number;
  /** The tier after the current one, or null at GOLD (the top). */
  nextTier: TrustTier | null;
  /** Confirmed contributions required to reach `nextTier`, or null at GOLD. */
  nextTierAt: number | null;
  /** How many more are needed right now, or null at GOLD. */
  contributionsToNextTier: number | null;
}

/**
 * The tier plus how far the donor is from the next one.
 *
 * The thresholds are the server's business rule, so the client must not hardcode them — without
 * this the app can show a tier badge but has no way to say "3 more to Silver", and any client
 * that tried would silently drift the moment product tunes the numbers above.
 */
export function computeTrustTierProgress(confirmedContributionsCount: number): TrustTierProgress {
  const trustTier = computeTrustTier(confirmedContributionsCount);

  const nextTierAt =
    trustTier === "BRONZE" ? SILVER_THRESHOLD : trustTier === "SILVER" ? GOLD_THRESHOLD : null;
  const nextTier: TrustTier | null = trustTier === "BRONZE" ? "SILVER" : trustTier === "SILVER" ? "GOLD" : null;

  return {
    trustTier,
    confirmedContributionsCount,
    nextTier,
    nextTierAt,
    contributionsToNextTier: nextTierAt === null ? null : Math.max(0, nextTierAt - confirmedContributionsCount),
  };
}
