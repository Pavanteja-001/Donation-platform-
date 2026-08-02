import { useEffect, useState } from "react";
import { CATEGORIES, type NeedCategory } from "../lib/needCategory";
import {
  confirmContribution,
  fetchContributions,
  fetchNeed,
  rejectContribution,
  rejectNeed,
  setNeedCategory,
  setNeedUrgency,
  verifyNeed,
  type BloodPayload,
  type Contribution,
  type GoodsPayload,
  type KitPayload,
  type MealSlotPayload,
  type MoneyPayload,
  type SkillRequestPayload,
  type Need,
  type Urgency,
} from "../lib/api";
import { shareNeedViaWhatsApp } from "../lib/whatsapp";
import { buildUpiDeepLink, buildUpiQrCodeUrl } from "../lib/upi";
import { useAuth } from "../context/AuthContext";
import { PageSkeleton } from "../components/SkeletonLoader";

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

function isSkillRequestPayload(payload: Need["payload"]): payload is SkillRequestPayload {
  return !!payload && typeof (payload as SkillRequestPayload).volunteers_needed === "number";
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

/** One label/value pair in the requester grid. Renders "Not provided" rather than blank, so a
    missing field is visibly missing instead of looking like a layout bug. */
function DetailField({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const shown = value && value.trim() ? value : null;
  return (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className="detail-value">
        {shown ? href ? <a href={href}>{shown}</a> : shown : <span className="detail-empty">Not provided</span>}
      </div>
    </div>
  );
}

function isNewAccount(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
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
    // Optimistic update
    setNeed((prev) => (prev ? { ...prev, adminVerified: true, status: "LIVE" } : null));
    try {
      await verifyNeed(token, needId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setBusy(false);
      load();
    }
  }

  async function handleCategory(category: NeedCategory | null) {
    if (!token) return;
    setBusy(true);
    try {
      const { need: updated } = await setNeedCategory(token, needId, category);
      // Merge rather than replace: this response carries the bare Need, without the `postedBy`
      // relation the detail view renders — swapping the whole object would blank the poster.
      setNeed((current) => (current ? { ...current, category: updated.category } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set the category");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!token) return;
    const reason = window.prompt("Reason for rejecting this need (shown to the poster, D-017):");
    if (!reason) return;
    setBusy(true);
    // Optimistic update
    setNeed((prev) => (prev ? { ...prev, status: "REJECTED" } : null));
    try {
      await rejectNeed(token, needId, reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusy(false);
      load();
    }
  }

  async function handleContributionDecision(id: string, decision: "confirm" | "reject") {
    if (!token) return;
    setBusy(true);
    // `contributions` is null until the fetch lands — mapping over it unguarded would throw.
    setContributions((prev) =>
      prev
        ? prev.map((c) => (c.id === id ? { ...c, status: decision === "confirm" ? "CONFIRMED" : "REJECTED" } : c))
        : prev
    );
    try {
      await (decision === "confirm" ? confirmContribution : rejectContribution)(token, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update this contribution");
    } finally {
      setBusy(false);
      load();
    }
  }

  async function handleUrgencyChange(urgency: Urgency) {
    if (!token) return;
    setBusy(true);
    setNeed((prev) => (prev ? { ...prev, urgency } : null));
    try {
      await setNeedUrgency(token, needId, urgency);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update urgency");
    } finally {
      setBusy(false);
      load();
    }
  }

  if (error && !need) return <p className="error">{error}</p>;
  if (!need) return <PageSkeleton />;

  const money = need.type === "MONEY" && isMoneyPayload(need.payload) ? need.payload : null;
  const kit = need.type === "KIT" && isKitPayload(need.payload) ? need.payload : null;
  const blood = need.type === "BLOOD" && isBloodPayload(need.payload) ? need.payload : null;
  const mealSlot = need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload) ? need.payload : null;
  const goods = need.type === "GOODS" && isGoodsPayload(need.payload) ? need.payload : null;
  const skillRequest = need.type === "SKILL_REQUEST" && isSkillRequestPayload(need.payload) ? need.payload : null;

  return (
    <div>
      <button type="button" className="link" onClick={onBack}>
        ‹ Back to needs
      </button>
      <h2>{need.title}</h2>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", marginBottom: "16px" }}>
        <span className={`badge status-${need.status.toLowerCase()}`}>{need.status.replace("_", " ")}</span>
        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>· {need.type} · posted by {need.postedBy.name ?? need.postedBy.phone}</span>
        <button
          type="button"
          onClick={() => shareNeedViaWhatsApp(need)}
          style={{
            backgroundColor: "#25D366",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Share on WhatsApp
        </button>
      </div>
      <p>{need.description}</p>

      {/* Requester details — the point of the verification step is a human check, and that means
          being able to call the person and see where they say they are. The API only returns
          these fields to ADMIN/STAFF, so they're rendered defensively: an older backend (or a
          non-admin session) simply shows fewer rows rather than "undefined". */}
      <div className="card" style={{ margin: "16px 0", padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Requester details</h3>
        <div className="detail-grid">
          <DetailField label="Name" value={need.postedBy.name} />
          <DetailField
            label="Phone"
            value={need.postedBy.phone}
            href={need.postedBy.phone ? `tel:${need.postedBy.phone}` : undefined}
          />
          <DetailField
            label="Email"
            value={need.postedBy.email}
            href={need.postedBy.email ? `mailto:${need.postedBy.email}` : undefined}
          />
          <DetailField
            label="Registered location"
            value={[need.postedBy.area, need.postedBy.city].filter(Boolean).join(", ") || null}
          />
          <DetailField
            label="Member since"
            value={need.postedBy.createdAt ? new Date(need.postedBy.createdAt).toLocaleDateString() : null}
          />
        </div>
        {/* A brand-new account posting an urgent request is the classic fraud pattern, so the
            gap between signup and posting is worth surfacing rather than leaving to arithmetic. */}
        {need.postedBy.createdAt && isNewAccount(need.postedBy.createdAt) && (
          <div className="callout callout-warning" style={{ marginTop: 12, marginBottom: 0 }}>
            <strong>New account</strong>
            <span style={{ fontSize: 13 }}>
              This account was created less than 24 hours before you're viewing it. Worth an extra check.
            </span>
          </div>
        )}
      </div>

      {/* The request's own location, kept distinct from the requester's registered one above —
          when those two disagree it's exactly what a verifier wants to notice. */}
      {(need.city || need.area || (need.latitude && need.longitude)) && (
        <div className="meta-rows">
          <div className="meta-row">
            <strong>📍 Location</strong>
            <span>{[need.area, need.city].filter(Boolean).join(", ") || "Not set"}</span>
            {need.latitude && need.longitude && (
              <a
                href={`https://www.google.com/maps?q=${need.latitude},${need.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="btn-action-secondary"
              >
                🗺️ Open in Google Maps ({need.latitude.toFixed(4)}, {need.longitude.toFixed(4)})
              </a>
            )}
          </div>
        </div>
      )}

      {need.photos.length > 0 && (
        <div className="photo-gallery">
          {need.photos.map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </div>
      )}

      {money && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <div><strong>Progress:</strong> ₹{money.raised_amount.toLocaleString("en-IN")} / ₹{money.target_amount.toLocaleString("en-IN")}</div>
          <div style={{ marginTop: "4px" }}><strong>UPI ID:</strong> {money.upi_id}</div>
          <div style={{ marginTop: "12px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <a
              href={buildUpiDeepLink({ upiId: money.upi_id, payeeName: need.postedBy.name ?? "Beneficiary", amount: money.target_amount - money.raised_amount, note: need.title })}
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Pay via UPI Deep-Link
            </a>
            <img
              src={buildUpiQrCodeUrl({ upiId: money.upi_id, payeeName: need.postedBy.name ?? "Beneficiary", amount: money.target_amount - money.raised_amount, note: need.title })}
              alt="UPI QR Code"
              style={{ width: "120px", height: "120px", borderRadius: "8px", border: "1px solid var(--color-border)" }}
            />
          </div>
        </div>
      )}
      {kit && (
        <p className="hint">
          Progress: {kit.kits_funded} / {kit.kits_needed} kits · {kit.contents} · mode: {kit.mode}
          {kit.upi_id ? ` · UPI: ${kit.upi_id}` : ""}
        </p>
      )}
      {blood && (
        <div className="meta-rows">
          <div className="meta-row">
            <strong>Blood group</strong>
            <span className="badge">{formatGroup(blood.blood_group)}</span>
          </div>
          <div className="meta-row">
            <strong>Progress</strong>
            <span>
              {blood.units_fulfilled} / {blood.units_needed} units
            </span>
          </div>
          {need.linkedInstitutionId && (
            <div className="meta-row">
              <strong>Institution</strong>
              <span>{need.institutionVerified ? "Verified by the linked institution" : "Awaiting institution verification"}</span>
            </div>
          )}
        </div>
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
          <strong>{goods.direction === "OFFER" ? "Being given away" : "Requested"}</strong> · Item: {goods.item}
          {(goods.quantity ?? 1) > 1 ? ` ×${goods.quantity}` : ""} ·{" "}
          {goods.direction === "OFFER" ? "Condition" : "Acceptable condition"}: {goods.condition} ·{" "}
          {goods.claimed ? "Claimed" : "Not yet claimed"}
        </p>
      )}
      {skillRequest && (
        <div style={{ backgroundColor: "var(--color-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "20px" }}>
          <div><strong>Volunteers Progress:</strong> {skillRequest.volunteers_joined} / {skillRequest.volunteers_needed} volunteers joined</div>
          <div><strong>Role Needed:</strong> {skillRequest.role_needed}</div>
          <div><strong>Date &amp; Time:</strong> {skillRequest.date} at {skillRequest.time}</div>
        </div>
      )}
      {need.status === "REJECTED" && need.rejectionReason && <p className="error">Rejected: {need.rejectionReason}</p>}
      {error && <p className="error">{error}</p>}

      {NON_TERMINAL.includes(need.status) && (
        <div className="meta-row" style={{ marginBottom: 16 }}>
          <strong>Urgency</strong>
          {URGENCIES.map((u) => (
            <button
              key={u}
              type="button"
              className={need.urgency === u ? "chip active" : "chip"}
              onClick={() => handleUrgencyChange(u)}
              disabled={busy || need.urgency === u}
            >
              {u}
            </button>
          ))}
        </div>
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

      {/* Filing, not content — so unlike the rest of the need it stays editable after going live.
          Only the categories this need's type can belong to are offered; the server enforces the
          same rule, so a stale tab can't file a BLOOD need under Orphanages. */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Category</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          {need.category
            ? "Which tile this need appears under in the app."
            : "Not categorised — this need is invisible to every category tile in the app."}
        </p>
        <div className="row-actions" style={{ flexWrap: "wrap" }}>
          {CATEGORIES.filter((c) => c.types.includes(need.type)).map((c) => (
            <button
              key={c.id}
              type="button"
              className={need.category === c.id ? "btn" : "btn-outline"}
              disabled={busy}
              onClick={() => handleCategory(need.category === c.id ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

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
