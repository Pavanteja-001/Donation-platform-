import { useEffect, useState } from "react";
import {
  confirmContribution,
  fetchContributions,
  fetchNeed,
  rejectContribution,
  rejectNeed,
  verifyNeed,
  type Contribution,
  type MoneyPayload,
  type Need,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

export function NeedDetailPage({ needId, onBack }: { needId: string; onBack: () => void }) {
  const { token, isAdmin } = useAuth();
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
      .catch(() => setContributions([])); // e.g. DRAFT need with no contributions endpoint access yet
  }

  useEffect(load, [token, needId]);

  async function handleVerify() {
    if (!token) return;
    setBusy(true);
    try {
      await verifyNeed(token, needId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!token) return;
    const reason = window.prompt("Reason for rejecting this need (shown to the poster, D-017):");
    if (!reason) return;
    setBusy(true);
    try {
      await rejectNeed(token, needId, reason);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusy(false);
    }
  }

  async function handleContributionDecision(id: string, decision: "confirm" | "reject") {
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

  return (
    <div>
      <button type="button" className="link" onClick={onBack}>
        ‹ Back to needs
      </button>
      <h2>{need.title}</h2>
      <p className="hint">
        <span className={`badge status-${need.status.toLowerCase()}`}>{need.status.replace("_", " ")}</span>{" "}
        · {need.type} · posted by {need.postedBy.name ?? need.postedBy.phone}
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

      {need.status === "PENDING_VERIFICATION" && (
        <div className="row-actions">
          <button type="button" className="btn" onClick={handleVerify} disabled={busy}>
            Verify
          </button>
          <button type="button" className="btn-danger-outline" onClick={handleReject} disabled={busy}>
            Reject
          </button>
        </div>
      )}

      {contributions && contributions.length > 0 && (
        <div>
          <h3>Contributions</h3>
          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>UTR</th>
                <th>Status</th>
                {isAdmin && <th>Override</th>}
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id}>
                  <td>{c.donor.name ?? c.donor.phone}</td>
                  <td>₹{c.amount.toLocaleString("en-IN")}</td>
                  <td>{c.utr}</td>
                  <td>{c.status.replace("_", " ")}</td>
                  {isAdmin && (
                    <td>
                      {c.status === "PENDING_CONFIRMATION" && (
                        <div className="row-actions">
                          <button type="button" className="link" onClick={() => handleContributionDecision(c.id, "confirm")} disabled={busy}>
                            Confirm
                          </button>
                          <button type="button" className="link danger" onClick={() => handleContributionDecision(c.id, "reject")} disabled={busy}>
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!isAdmin && (
            <p className="hint">
              Confirming/rejecting a contribution on behalf of the beneficiary is an Admin-only override (D-018) —
              Staff can verify/reject the need itself, but not this.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
