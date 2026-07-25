import type { ReactNode } from "react";

// PRD Appendix A.3 — the standard surface container (border + radius, optional elevation).
export function Card({ children, elevated = false }: { children: ReactNode; elevated?: boolean }) {
  return <div className={elevated ? "card card-elevated" : "card"}>{children}</div>;
}
