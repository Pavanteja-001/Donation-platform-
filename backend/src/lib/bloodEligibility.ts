import type { Gender, User } from "@prisma/client";

// PRD §8.2 / D-005 — India donation-gap rules. Computed on demand, never cached.
const MIN_AGE = 18;
const MAX_AGE = 65;
const GAP_DAYS_MALE = 90;
const GAP_DAYS_FEMALE = 120;
const GAP_DAYS_OTHER = 120;

export interface EligibilityResult {
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
  if (!user.bloodGroup) {
    return { hasProfile: false, eligible: false, reasons: ["No blood donor profile"] };
  }

  const reasons: string[] = [];

  if (user.dateOfBirth) {
    const age = ageFromDOB(user.dateOfBirth, now);
    if (age < MIN_AGE || age > MAX_AGE) {
      reasons.push(`Age ${age} is outside the ${MIN_AGE}-${MAX_AGE} eligible range`);
    }
  }

  if (user.lastDonationDate) {
    const requiredGap = user.gender ? gapDaysFor(user.gender) : GAP_DAYS_MALE;
    const daysSinceLast = Math.floor((now.getTime() - user.lastDonationDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLast < requiredGap) {
      reasons.push(`Only ${daysSinceLast} days since last donation — needs ${requiredGap}`);
    }
  }

  if (!user.availableToDonate) {
    reasons.push("Marked unavailable to donate");
  }

  return {
    hasProfile: true,
    eligible: reasons.length === 0,
    reasons,
  };
}
