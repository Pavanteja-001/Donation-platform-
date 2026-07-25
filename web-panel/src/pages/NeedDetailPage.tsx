import { useEffect, useState } from "react";
import {
  confirmContribution,
  fetchContributions,
  fetchNeed,
  institutionVerifyNeed,
  rejectContribution,
  type BloodPayload,
  type Contribution,
  type KitPayload,
  type MoneyPayload,
  type Need,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

function isKitPayload(payload: Need["payload"]): payload is KitPayload {
  return !!payload && typeof (payload as KitPayload).kits_needed === "number";
}

function isBloodPayload(payload: Need["payload"]): payload is BloodPayload {
  return !!payload && typeof (payload as BloodPayload).units_needed === "number";
}

function formatGroup(g: BloodPayload["blood_group"]) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

// Kind-aware — a BLOOD contribution has neither `amount` nor `kits`, only `units`.
function formatContributionAmount(c: Contribution): string {
  if (c.kind === "KIT") return `${c.kits} kits`;
  if (c.kind === "BLOOD") return `${c.units} units`;
  return `₹${c.amount?.toLocaleString("en-IN")}`;
}

export function NeedDetailPage({ needId, onBack }: { needId: string; onBack: () => void }) {
  const { token, user } = useAuth();
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

  async function handleInstitutionVerify() {
    if (!token || !need) return;
    setBusy(true);
    try {
      await institutionVerifyNeed(token, need.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify this need");
    } finally {
      setBusy(false);
    }
  }

  if (error && !need) return <p className="error">{error}</p>;
  if (!need) return <p className="hint">Loading…</p>;

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const pending = contributions?.filter((c) => c.status === "PENDING_CONFIRMATION") ?? [];
  // D-008 — fast-track: this institution can self-verify its own linked need instead of
  // waiting on admin, but only while it's still pending and only if it's really theirs.
  const canInstitutionVerify =
    need.status === "PENDING_VERIFICATION" && !!user && need.linkedInstitutionId === user.id && !need.institutionVerified;

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

      {need.photos.length > 0 && (
        <div className="photo-gallery">
          {need.photos.map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </div>
      )}

      {money && (
        <p className="hint">
          Progress: ₹{money.raised_amount.toLocaleString("en-IN")} / ₹{money.target_amount.toLocaleString("en-IN")} ·
          UPI: {money.upi_id}
        </p>
      )}
      {kit && (
        <p className="hint">
          Progress: {kit.kits_funded} / {kit.kits_needed} kits · {kit.contents} · mode: {kit.mode}
        </p>
      )}
      {blood && (
        <p className="hint">
          Progress: {blood.units_fulfilled} / {blood.units_needed} units · blood group: {formatGroup(blood.blood_group)}
        </p>
      )}
      {canInstitutionVerify && (
        <p>
          <button type="button" className="btn" onClick={handleInstitutionVerify} disabled={busy}>
            Verify this need (fast-track)
          </button>
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
                <td>{formatContributionAmount(c)}</td>
                <td>{c.utr ?? "—"}</td>
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
