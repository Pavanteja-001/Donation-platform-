export type BadgeTone = "primary" | "accent" | "danger" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  primary: "badge badge-tone-primary",
  accent: "badge badge-tone-accent",
  danger: "badge badge-tone-danger",
  neutral: "badge",
};

// PRD Appendix A.4 — "badges (verified, trust tier)" + status badges. Callers map their own
// domain value (NeedStatus/Role/TrustTier/...) to a tone; this component doesn't know about any
// of them, same split as mobile's Badge.
export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return <span className={TONE_CLASS[tone]}>{label}</span>;
}
