import { useEffect, useState } from "react";
import {
  confirmContribution,
  fetchContributions,
  fetchNeed,
  institutionVerifyNeed,
  rejectContribution,
  type BloodPayload,
  type Contribution,
  type GoodsPayload,
  type KitPayload,
  type MealSlotPayload,
  type MoneyPayload,
  type Need,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

function isKitPayload(payload: Need["payload"]): payload is KitPayload {
  return !!payload && typeof (payload as KitPayload).kits_needed === "number";
}

function isBloodPayload(payload: Need["payload"]): payload is BloodPayload {
  return !!payload && typeof (payload as BloodPayload).units_needed === "number";
}

function isMealSlotPayload(payload: Need["payload"]): payload is MealSlotPayload {
  return !!payload && typeof (payload as MealSlotPayload).slots_total === "number";
}

function isGoodsPayload(payload: Need["payload"]): payload is GoodsPayload {
  return !!payload && typeof (payload as GoodsPayload).item === "string";
}

function formatGroup(g: BloodPayload["blood_group"]) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

function formatContributionAmount(c: Contribution): string {
  if (c.kind === "KIT") return `${c.kits} kits`;
  if (c.kind === "BLOOD") return `${c.units} units`;
  if (c.kind === "MEAL_SLOT") {
    const date = c.mealSlotDate ? new Date(c.mealSlotDate).toLocaleDateString() : "";
    return c.amount != null ? `₹${c.amount.toLocaleString("en-IN")} · ${date}` : date;
  }
  if (c.kind === "GOODS") return "Claim";
  return `₹${c.amount?.toLocaleString("en-IN")}`;
}

function DetailSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "24px" }}>
      <Skeleton width="120px" height={16} />
      <Skeleton width="60%" height={32} />
      <Skeleton width="100%" height={80} style={{ borderRadius: "8px" }} />
      <Skeleton width="100%" height={160} style={{ borderRadius: "8px" }} />
    </div>
  );
}

export function NeedDetailPage({ needId, onBack }: { needId: string; onBack: () => void }) {
  const { token, user } = useAuth();
  const [need, setNeed] = useState<Need | null>(null);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!token) return;
    setError(null);
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

  if (error && !need) return <ErrorState message={error} onRetry={load} />;
  if (!need) return <DetailSkeleton />;

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const mealSlot = need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload) ? need.payload : null;
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;
  const pending = contributions?.filter((c) => c.status === "PENDING_CONFIRMATION") ?? [];
  const canInstitutionVerify =
    need.status === "PENDING_VERIFICATION" && !!user && need.linkedInstitutionId === user.id && !need.institutionVerified;

  return (
    <div>
      <button type="button" className="link" onClick={onBack} style={{ marginBottom: "16px" }}>
        ‹ Back to your needs
      </button>
      <h2>{need.title}</h2>
      <p className="hint" style={{ marginTop: "4px" }}>
        <span className={`badge status-${need.status.toLowerCase()}`}>{need.status.replace("_", " ")}</span>
      </p>
      <p style={{ marginTop: "16px", marginBottom: "16px", fontSize: "15px", lineHeight: "1.5" }}>{need.description}</p>

      {need.photos.length > 0 && (
        <div className="photo-gallery" style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          {need.photos.map((url) => (
            <img key={url} src={url} alt="" style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--color-border)" }} />
          ))}
        </div>
      )}

      {money && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <strong>Target Raised:</strong> ₹{money.raised_amount.toLocaleString("en-IN")} / ₹{money.target_amount.toLocaleString("en-IN")}
          <br />
          <strong>UPI ID:</strong> {money.upi_id}
        </div>
      )}
      {kit && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <strong>Kits Progress:</strong> {kit.kits_funded} / {kit.kits_needed} kits
          <br />
          <strong>Contents:</strong> {kit.contents}
          <br />
          <strong>Mode:</strong> {kit.mode}
        </div>
      )}
      {blood && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <strong>Units Progress:</strong> {blood.units_fulfilled} / {blood.units_needed} units
          <br />
          <strong>Blood Group Required:</strong> {formatGroup(blood.blood_group)}
        </div>
      )}
      {mealSlot && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <strong>Slots Confirmed:</strong> {mealSlot.slots_confirmed} / {mealSlot.slots_total} slots
          <br />
          <strong>Meal Type:</strong> {mealSlot.meal_type} · <strong>Mode:</strong> {mealSlot.mode}
          <div className="row-actions" style={{ flexWrap: "wrap", marginTop: "12px", gap: "8px" }}>
            {need.mealSlots.map((slot) => (
              <span key={slot.id} className={`badge status-${slot.status.toLowerCase()}`}>
                {new Date(slot.date).toLocaleDateString()} · {slot.status}
              </span>
            ))}
          </div>
        </div>
      )}
      {goods && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <strong>Item:</strong> {goods.item}
          <br />
          <strong>Condition Required:</strong> {goods.condition}
          <br />
          <strong>Status:</strong> {goods.claimed ? "Claimed" : "Not yet claimed"}
        </div>
      )}

      {canInstitutionVerify && (
        <div style={{ marginTop: "16px", marginBottom: "20px" }}>
          <button type="button" className="btn" onClick={handleInstitutionVerify} disabled={busy}>
            Verify this need (fast-track)
          </button>
        </div>
      )}

      {need.status === "REJECTED" && need.rejectionReason && (
        <div style={{ backgroundColor: "#fff5f5", border: "1px solid #feb2b2", padding: "16px", borderRadius: "8px", color: "#c53030", marginBottom: "20px" }}>
          <strong>Rejected Reason:</strong> {need.rejectionReason}
        </div>
      )}

      {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}

      <h3>Contributions awaiting your confirmation</h3>
      {pending.length === 0 && (
        <div style={{ marginTop: "12px" }}>
          <EmptyState title="No pending contributions" subtitle="All contributions to this need have been confirmed or rejected." />
        </div>
      )}
      
      {pending.length > 0 && (
        <table style={{ marginTop: "12px" }}>
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
                <td style={{ fontWeight: 600 }}>{c.donor.name ?? c.donor.phone}</td>
                <td style={{ fontWeight: 500 }}>{formatContributionAmount(c)}</td>
                <td>{c.utr ?? "—"}</td>
                <td>
                  <div className="row-actions" style={{ gap: "8px" }}>
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
