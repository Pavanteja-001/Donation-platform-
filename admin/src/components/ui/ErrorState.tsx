import { Button } from "./Button";

// PRD Appendix A.5 — the other required-but-missing state: today errors just render as a plain
// `<p className="error">`, no way to retry without leaving the page.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state">
      <p className="error-state-message">{message}</p>
      {onRetry && <Button label="Try again" variant="secondary" onClick={onRetry} />}
    </div>
  );
}
