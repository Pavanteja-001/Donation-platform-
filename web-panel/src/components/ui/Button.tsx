import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn",
  secondary: "btn-secondary-outline",
  danger: "btn-danger-outline",
};

// PRD Appendix A.4 — one Button component instead of every page reaching for a raw
// `<button className="btn">`/`className="btn-danger-outline"` directly (Chunk 7 migrates the
// rest; this establishes the component and the loading-state affordance nothing had before).
export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  ...rest
}: { label: string; variant?: ButtonVariant; loading?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type="button" className={VARIANT_CLASS[variant]} disabled={disabled || loading} {...rest}>
      {loading ? "…" : label}
    </button>
  );
}
