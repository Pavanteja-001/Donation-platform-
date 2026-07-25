import type { CSSProperties } from "react";

// PRD Appendix A.5 — loading state. A single pulsing block (CSS animation, see index.css);
// screens compose several into a skeleton shape instead of a bare spinner.
export function Skeleton({ width = "100%", height = 16, style }: { width?: string | number; height?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}
