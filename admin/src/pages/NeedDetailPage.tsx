import { useEffect, useState } from "react";
import {
  confirmContribution,
  fetchContributions,
  fetchNeed,
  rejectContribution,
  rejectNeed,
  setNeedUrgency,
  verifyNeed,
  type BloodPayload,
  type Contribution,
  type GoodsPayload,
  type KitPayload,
  type MealSlotPayload,
  type MoneyPayload,
  type Need,
  type Urgency,
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

function isMealSlotPayload(payload: Need["payload"]): payload is MealSlotPayload {
  return !!payload && typeof (payload as MealSlotPayload).slots_total === "number";
}

function isGoodsPayload(payload: Need["payload"]): payload is GoodsPayload {
  return !!payload && typeof (payload as GoodsPayload).item === "string";
}

function formatGroup(g: BloodPayload["blood_group"]) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

// Kind-aware — a BLOOD contribution has neither `amount` nor `kits`, only `units`; a MEAL_SLOT
// one carries the booked date instead; a GOODS one is just a claim.
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

const NON_TERMINAL: Need["status"][] = ["PENDING_VERIFICATION", "LIVE", "PARTIALLY_FULFILLED"];
const URGENCIES: Urgency[] = ["NORMAL", "URGENT", "EMERGENCY"];

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

  async function handleUrgencyChange(urgency: Urgency) {
    if (!token) return;
    setBusy(true);
    try {
      await setNeedUrgency(token, needId, urgency);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update urgency");
    } finally {
      setBusy(false);
    }
  }

  if (error && !need) return <p className="error">{error}</p>;
  if (!need) return <p className="hint">Loading…</p>;

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const mealSlot = need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload) ? need.payload : null;
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;

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
          {kit.upi_id ? ` · UPI: ${kit.upi_id}` : ""}
        </p>
      )}
      {blood && (
        <p className="hint">
          Progress: {blood.units_fulfilled} / {blood.units_needed} units · blood group: {formatGroup(blood.blood_group)}
          {need.linkedInstitutionId ? ` · institution-verified: ${need.institutionVerified ? "yes" : "no"}` : ""}
        </p>
      )}
      {mealSlot && (
        <>
          <p className="hint">
            Progress: {mealSlot.slots_confirmed} / {mealSlot.slots_total} slots · {mealSlot.meal_type} · mode:{" "}
            {mealSlot.mode}
            {need.linkedInstitutionId ? ` · institution-verified: ${need.institutionVerified ? "yes" : "no"}` : ""}
          </p>
          <div className="row-actions" style={{ flexWrap: "wrap" }}>
            {need.mealSlots.map((slot) => (
              <span key={slot.id} className={`badge status-${slot.status.toLowerCase()}`}>
                {new Date(slot.date).toLocaleDateString()} · {slot.status}
              </span>
            ))}
          </div>
        </>
      )}
      {goods && (
        <p className="hint">
          Item: {goods.item} · Acceptable condition: {goods.condition} · {goods.claimed ? "Claimed" : "Not yet claimed"}
        </p>
      )}
      {need.status === "REJECTED" && need.rejectionReason && <p className="error">Rejected: {need.rejectionReason}</p>}
      {error && <p className="error">{error}</p>}

      {NON_TERMINAL.includes(need.status) && (
        <p className="hint">
          Urgency (D-012 — never self-declared):{" "}
          {URGENCIES.map((u) => (
            <button
              key={u}
              type="button"
              className={need.urgency === u ? "chip active" : "chip"}
              onClick={() => handleUrgencyChange(u)}
              disabled={busy || need.urgency === u}
              style={{ marginLeft: 4 }}
            >
              {u}
            </button>
          ))}
        </p>
      )}

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
                  <td>{formatContributionAmount(c)}</td>
                  <td>{c.utr ?? "—"}</td>
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
