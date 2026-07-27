import type { CSSProperties, ReactNode } from "react";

// PRD Appendix A.3 — the standard surface container (border + radius, optional elevation).
export function Card({
  children,
  elevated = false,
  className = "",
  style,
}: {
  children: ReactNode;
  elevated?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const cls = elevated ? `card card-elevated ${className}`.trim() : `card ${className}`.trim();
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
