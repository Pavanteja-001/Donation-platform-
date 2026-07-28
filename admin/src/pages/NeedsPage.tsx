import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cancelNeed,
  deleteNeed,
  fetchAdminNeeds,
  rejectNeed,
  verifyNeed,
  type Need,
  type NeedStatus,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

// Mirrors the backend lifecycle graph (needLifecycle.ts): only a non-terminal need can move to
// CANCELLED. Offering the button anywhere else would just produce a 409.
const CANCELLABLE_STATUSES: NeedStatus[] = ["DRAFT", "PENDING_VERIFICATION", "LIVE", "PARTIALLY_FULFILLED"];

const STATUS_FILTERS: { label: string; value: NeedStatus | "ALL" | undefined }[] = [
  { label: "Verification queue", value: undefined },
  { label: "Live", value: "LIVE" },
  { label: "Partially funded", value: "PARTIALLY_FULFILLED" },
  { label: "Fulfilled", value: "FULFILLED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "All", value: "ALL" },
];

function progressLabel(need: Need): string | null {
  if (!need.payload) return null;
  if (need.type === "MONEY") {
    const p = need.payload as { raised_amount?: number; target_amount?: number };
    if (typeof p.raised_amount !== "number" || typeof p.target_amount !== "number") return null;
    return `₹${p.raised_amount.toLocaleString("en-IN")} / ₹${p.target_amount.toLocaleString("en-IN")}`;
  }
  if (need.type === "KIT") {
    const p = need.payload as { kits_funded?: number; kits_needed?: number };
    if (typeof p.kits_funded !== "number" || typeof p.kits_needed !== "number") return null;
    return `${p.kits_funded} / ${p.kits_needed} kits`;
  }
  if (need.type === "MEAL_SLOT") {
    const p = need.payload as { slots_confirmed?: number; slots_total?: number };
    if (typeof p.slots_confirmed !== "number" || typeof p.slots_total !== "number") return null;
    return `${p.slots_confirmed} / ${p.slots_total} slots`;
  }
  if (need.type === "BLOOD") {
    const p = need.payload as { units_fulfilled?: number; units_needed?: number };
    if (typeof p.units_fulfilled !== "number" || typeof p.units_needed !== "number") return null;
    return `${p.units_fulfilled} / ${p.units_needed} units`;
  }
  if (need.type === "GOODS") {
    const p = need.payload as { claimed?: boolean };
    if (typeof p.claimed !== "boolean") return null;
    return p.claimed ? "Claimed" : "Not yet claimed";
  }
  if (need.type === "SKILL_REQUEST") {
    const p = need.payload as { volunteers_joined?: number; volunteers_needed?: number };
    if (typeof p.volunteers_joined !== "number" || typeof p.volunteers_needed !== "number") return null;
    return `${p.volunteers_joined} / ${p.volunteers_needed} volunteers`;
  }
  return null;
}

export function NeedsPage() {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const [filter, setFilter] = useState<NeedStatus | "ALL" | undefined>(undefined);
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setError(null);
    setNeeds(null); // Show PageSkeleton shimmer while fetching
    fetchAdminNeeds(token, filter)
      .then(({ needs }) => setNeeds(needs))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load needs"));
  }

  useEffect(load, [token, filter]);

  async function handleVerify(id: string) {
    if (!token) return;
    setBusyId(id);
    // Instant Optimistic State Update
    setNeeds((prev) =>
      prev ? prev.map((n) => (n.id === id ? { ...n, adminVerified: true, status: "LIVE" as NeedStatus } : n)) : null
    );
    try {
      await verifyNeed(token, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function handleReject(id: string) {
    if (!token) return;
    const reason = window.prompt("Reason for rejecting this need (shown to the poster, D-017):");
    if (!reason) return;
    setBusyId(id);
    // Instant Optimistic State Update
    setNeeds((prev) =>
      prev ? prev.map((n) => (n.id === id ? { ...n, status: "REJECTED" as NeedStatus } : n)) : null
    );
    try {
      await rejectNeed(token, id, reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusyId(null);
      load();
    }
  }

  // Take a live request down without destroying its history — the normal lever, and the only
  // one staff get. CANCELLED is terminal, so it drops out of the feed and the map for good.
  async function handleCancel(id: string, title: string) {
    if (!token) return;
    if (!window.confirm(`Cancel "${title}"? It disappears from the donor feed and map. Contributions and history are kept.`)) return;
    setBusyId(id);
    setNeeds((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, status: "CANCELLED" as NeedStatus } : n)) : null));
    try {
      await cancelNeed(token, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setBusyId(null);
      load();
    }
  }

  // Irreversible, and the server refuses it once anyone has contributed — for junk posts only.
  async function handleDelete(id: string, title: string) {
    if (!token) return;
    if (!window.confirm(`Permanently delete "${title}"? This cannot be undone. Use Cancel instead if this was a real request.`)) return;
    setBusyId(id);
    try {
      await deleteNeed(token, id);
      setNeeds((prev) => (prev ? prev.filter((n) => n.id !== id) : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>Needs Management</h2>
      <p className="hint">Every need goes through admin (or staff) verification before it's visible to donors (D-017/D-018).</p>

      <div className="filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={filter === f.value ? "chip active" : "chip"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !needs && <PageSkeleton />}
      {!error && needs && needs.length === 0 && (
        <EmptyState title="No needs found" subtitle="Needs matching this status filter will show up here." />
      )}

      {!error && needs && needs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Title &amp; Location</th>
              <th className="col-type">Type</th>
              <th className="col-status">Status</th>
              <th>Posted by</th>
              <th className="col-progress">Progress</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {needs.map((n) => (
              <tr key={n.id}>
                <td>
                  <button type="button" className="link-cell" onClick={() => navigate(`/needs/${n.id}`)} style={{ fontWeight: 600 }}>
                    {n.title}
                  </button>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    📍 {n.area ? `${n.area}, ${n.city}` : (n.city ?? "No location set")}
                  </div>
                </td>
                <td style={{ fontWeight: 500 }}>{n.type}</td>
                <td>
                  <span className={`badge status-${n.status.toLowerCase()}`}>{n.status.replace("_", " ")}</span>
                </td>
                <td>{n.postedBy.name ?? n.postedBy.phone ?? "—"}</td>
                <td className="cell-progress" style={{ fontWeight: 500 }}>{progressLabel(n) ?? "—"}</td>
                <td>
                  <div className="row-actions" style={{ gap: 6 }}>
                    <button type="button" className="btn-action-primary" onClick={() => navigate(`/needs/${n.id}`)}>
                      View Details
                    </button>
                    {n.latitude && n.longitude && (
                      <a
                        href={`https://maps.google.com/?q=${n.latitude},${n.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-action-secondary"
                      >
                        Location Map
                      </a>
                    )}
                    {n.status === "PENDING_VERIFICATION" && (
                      <>
                        <button type="button" className="btn-action-success" onClick={() => handleVerify(n.id)} disabled={busyId === n.id}>
                          Verify
                        </button>
                        <button type="button" className="btn-action-danger" onClick={() => handleReject(n.id)} disabled={busyId === n.id}>
                          Reject
                        </button>
                      </>
                    )}
                    {/* Cancel is the safe take-down for anything still alive; delete is admin-only
                        and the server blocks it once a need has contributions. */}
                    {CANCELLABLE_STATUSES.includes(n.status) && (
                      <button
                        type="button"
                        className="btn-action-danger"
                        onClick={() => handleCancel(n.id, n.title)}
                        disabled={busyId === n.id}
                      >
                        Cancel
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-action-danger"
                        onClick={() => handleDelete(n.id, n.title)}
                        disabled={busyId === n.id}
                        title="Permanently delete — blocked if anyone has contributed"
                      >
                        Delete
                      </button>
                    )}
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
