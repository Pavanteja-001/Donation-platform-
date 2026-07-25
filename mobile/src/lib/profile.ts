import type { AuthUser } from "./api";

export function isProfileComplete(user: AuthUser | null): boolean {
  if (!user) return false;
  return !!(
    user.name &&
    user.city &&
    user.area &&
    user.bloodGroup &&
    user.dateOfBirth &&
    user.gender
  );
}
