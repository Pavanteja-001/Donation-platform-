function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

// PRD Appendix A.4 — a plain initials avatar (no profile-photo upload feature exists).
export function Avatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initialsFrom(name)}
    </span>
  );
}
