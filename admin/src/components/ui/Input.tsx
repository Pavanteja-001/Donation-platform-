import type { InputHTMLAttributes } from "react";

// PRD Appendix A.4 — labeled input with prefix and error slot support.
export function Input({
  label,
  prefix,
  error,
  ...rest
}: { label: string; prefix?: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "children">) {
  return (
    <label>
      {label}
      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
        {prefix && (
          <span style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            marginRight: "8px",
            userSelect: "none"
          }}>
            {prefix}
          </span>
        )}
        <input {...rest} style={{ flex: 1, ...rest.style }} />
      </div>
      {error && <p className="field-error">{error}</p>}
    </label>
  );
}
