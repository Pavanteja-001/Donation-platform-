// PRD Appendix A.4 — the selectable/filter chip, already reimplemented ad hoc as `.mode-option`
// (blood group / kit mode pickers). New call sites should reach for this instead; existing
// `.mode-option` usages stay as-is for now (Chunk 7 migrates them alongside full screen polish).
export function Chip({ label, active = false, onClick, disabled = false }: { label: string; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={active ? "chip active" : "chip"} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
