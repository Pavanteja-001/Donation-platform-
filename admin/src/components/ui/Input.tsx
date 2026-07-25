import type { InputHTMLAttributes } from "react";

// PRD Appendix A.4 — labeled input with an inline error slot, so real form validation (Chunk 6)
// has one place to render into. Existing forms' plain `<label>text<input/></label>` pattern
// keeps working (same CSS) — this just adds the error affordance nothing had before.
export function Input({
  label,
  error,
  ...rest
}: { label: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "children">) {
  return (
    <label>
      {label}
      <input {...rest} />
      {error && <p className="field-error">{error}</p>}
    </label>
  );
}
