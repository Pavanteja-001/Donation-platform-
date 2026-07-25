import type { Gender, User } from "@prisma/client";

// PRD §8.2 / D-005 — India donation-gap rules. Computed on demand, never cached (see §8.2 for
// why: eligibility changes purely by the calendar, independent of any action on a Need).
const MIN_AGE = 18;
const MAX_AGE = 65;
const GAP_DAYS_MALE = 90;
const GAP_DAYS_FEMALE = 120;
// No India-specific rule exists for a non-binary gender marker — default to the more
// conservative (longer) of the two known gaps rather than guessing.
const GAP_DAYS_OTHER = 120;

export interface EligibilityResult {
  // False if the user has no blood profile at all (§8.1) — distinct from "ineligible": they're
  // simply not a match candidate, not a candidate who failed a check.
  hasProfile: boolean;
  eligible: boolean;
  reasons: string[];
}

type BloodProfileFields = Pick<User, "bloodGroup" | "dateOfBirth" | "gender" | "lastDonationDate" | "availableToDonate">;

function ageFromDOB(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function gapDaysFor(gender: Gender): number {
  if (gender === "MALE") return GAP_DAYS_MALE;
  if (gender === "FEMALE") return GAP_DAYS_FEMALE;
  return GAP_DAYS_OTHER;
}

export function computeEligibility(user: BloodProfileFields, now: Date = new Date()): EligibilityResult {
  if (!user.bloodGroup || !user.dateOfBirth || !user.gender) {
    return { hasProfile: false, eligible: false, reasons: ["No blood donor profile"] };
  }

  const reasons: string[] = [];

  const age = ageFromDOB(user.dateOfBirth, now);
  if (age < MIN_AGE || age > MAX_AGE) {
    reasons.push(`Age ${age} is outside the ${MIN_AGE}-${MAX_AGE} eligible range`);
  }

  if (user.lastDonationDate) {
    const daysSinceLast = Math.floor((now.getTime() - user.lastDonationDate.getTime()) / (1000 * 60 * 60 * 24));
    const requiredGap = gapDaysFor(user.gender);
    if (daysSinceLast < requiredGap) {
      reasons.push(`Only ${daysSinceLast} days since last donation — needs ${requiredGap}`);
    }
  }

  if (!user.availableToDonate) {
    reasons.push("Marked unavailable to donate");
  }

  return { hasProfile: true, eligible: reasons.length === 0, reasons };
}
