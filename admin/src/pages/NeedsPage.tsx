import { useEffect, useState } from "react";
import { fetchAdminNeeds, rejectNeed, verifyNeed, type Need, type NeedStatus } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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
  if (need.type === "BLOOD") {
    const p = need.payload as { units_fulfilled?: number; units_needed?: number };
    if (typeof p.units_fulfilled !== "number" || typeof p.units_needed !== "number") return null;
    return `${p.units_fulfilled} / ${p.units_needed} units`;
  }
  return null;
}

export function NeedsPage({ onSelectNeed }: { onSelectNeed: (id: string) => void }) {
  const { token } = useAuth();
  const [filter, setFilter] = useState<NeedStatus | "ALL" | undefined>(undefined);
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    if (!token) return;
    fetchAdminNeeds(token, filter)
      .then(({ needs }) => setNeeds(needs))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load needs"));
  }

  useEffect(load, [token, filter]);

  async function handleVerify(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await verifyNeed(token, id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!token) return;
    const reason = window.prompt("Reason for rejecting this need (shown to the poster, D-017):");
    if (!reason) return;
    setBusyId(id);
    try {
      await rejectNeed(token, id, reason);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>Needs</h2>
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

      {error && <p className="error">{error}</p>}
      {!needs && !error && <p className="hint">Loading…</p>}

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th>Posted by</th>
            <th>Progress</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {needs?.map((n) => (
            <tr key={n.id}>
              <td>
                <button type="button" className="link-cell" onClick={() => onSelectNeed(n.id)}>
                  {n.title}
                </button>
              </td>
              <td>{n.type}</td>
              <td>
                <span className={`badge status-${n.status.toLowerCase()}`}>{n.status.replace("_", " ")}</span>
              </td>
              <td>{n.postedBy.name ?? n.postedBy.phone ?? "—"}</td>
              <td>{progressLabel(n) ?? "—"}</td>
              <td>
                {n.status === "PENDING_VERIFICATION" && (
                  <div className="row-actions">
                    <button type="button" className="link" onClick={() => handleVerify(n.id)} disabled={busyId === n.id}>
                      Verify
                    </button>
                    <button type="button" className="link danger" onClick={() => handleReject(n.id)} disabled={busyId === n.id}>
                      Reject
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {needs && needs.length === 0 && (
            <tr>
              <td colSpan={6} className="hint">
                Nothing here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
