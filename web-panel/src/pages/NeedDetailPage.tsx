import { useEffect, useState } from "react";
import {
  confirmContribution,
  fetchContributions,
  fetchNeed,
  rejectContribution,
  type Contribution,
  type MoneyPayload,
  type Need,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

export function NeedDetailPage({ needId, onBack }: { needId: string; onBack: () => void }) {
  const { token } = useAuth();
  const [need, setNeed] = useState<Need | null>(null);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!token) return;
    fetchNeed(token, needId)
      .then(({ need }) => setNeed(need))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load this need"));
    fetchContributions(token, needId)
      .then(({ contributions }) => setContributions(contributions))
      .catch(() => setContributions([]));
  }

  useEffect(load, [token, needId]);

  async function handleDecision(id: string, decision: "confirm" | "reject") {
    if (!token) return;
    setBusy(true);
    try {
      await (decision === "confirm" ? confirmContribution : rejectContribution)(token, id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update this contribution");
    } finally {
      setBusy(false);
    }
  }

  if (error && !need) return <p className="error">{error}</p>;
  if (!need) return <p className="hint">Loading…</p>;

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const pending = contributions?.filter((c) => c.status === "PENDING_CONFIRMATION") ?? [];

  return (
    <div>
      <button type="button" className="link" onClick={onBack}>
        ‹ Back to your needs
      </button>
      <h2>{need.title}</h2>
      <p className="hint">
        <span className={`badge status-${need.status.toLowerCase()}`}>{need.status.replace("_", " ")}</span>
      </p>
      <p>{need.description}</p>

      {money && (
        <p className="hint">
          Progress: ₹{money.raised_amount.toLocaleString("en-IN")} / ₹{money.target_amount.toLocaleString("en-IN")} ·
          UPI: {money.upi_id}
        </p>
      )}
      {need.status === "REJECTED" && need.rejectionReason && <p className="error">Rejected: {need.rejectionReason}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Contributions awaiting your confirmation</h3>
      {pending.length === 0 && <p className="hint">Nothing pending right now.</p>}
      {pending.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Amount</th>
              <th>UTR</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.map((c) => (
              <tr key={c.id}>
                <td>{c.donor.name ?? c.donor.phone}</td>
                <td>₹{c.amount.toLocaleString("en-IN")}</td>
                <td>{c.utr}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={() => handleDecision(c.id, "confirm")} disabled={busy}>
                      Confirm
                    </button>
                    <button type="button" className="btn-danger-outline" onClick={() => handleDecision(c.id, "reject")} disabled={busy}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
