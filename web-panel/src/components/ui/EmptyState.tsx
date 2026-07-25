import { Button } from "./Button";

// PRD Appendix A.5 — one of the four required states on every screen. Most list screens today
// just render a bare "You haven't posted anything yet" <p> (Chunk 7 migrates them); this gives
// that pattern a real, consistent shape with an optional call to action.
export function EmptyState({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="hint">{subtitle}</p>}
      {actionLabel && onAction && <Button label={actionLabel} variant="secondary" onClick={onAction} />}
    </div>
  );
}
