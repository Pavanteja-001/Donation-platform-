import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyNeeds,
  type BloodPayload,
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

function progressLabel(need: Need): string | null {
  if (need.type === "MONEY" && isMoneyPayload(need.payload)) {
    return `₹${need.payload.raised_amount.toLocaleString("en-IN")} / ₹${need.payload.target_amount.toLocaleString("en-IN")}`;
  }
  if (need.type === "KIT" && isKitPayload(need.payload)) {
    return `${need.payload.kits_funded} / ${need.payload.kits_needed} kits`;
  }
  if (need.type === "BLOOD" && isBloodPayload(need.payload)) {
    return `${need.payload.units_fulfilled} / ${need.payload.units_needed} units`;
  }
  if (need.type === "MEAL_SLOT" && isMealSlotPayload(need.payload)) {
    return `${need.payload.slots_confirmed} / ${need.payload.slots_total} slots`;
  }
  if (need.type === "GOODS" && isGoodsPayload(need.payload)) {
    return need.payload.claimed ? "Claimed" : "Not yet claimed";
  }
  return null;
}

// Chunk 2 (Milestone 9) — no longer owns the "+ X need" buttons (moved to the new /post chooser
// page, reached via the sidebar's "Post a Need" item); this is just the list + row navigation now.
export function MyNeedsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    fetchMyNeeds(token)
      .then(({ needs }) => setNeeds(needs))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your needs"));
  }, [token]);

  useEffect(load, [load]);

  return (
    <div>
      <div className="page-header-row">
        <h2>Your needs</h2>
      </div>
      <p className="hint">Every need is admin-verified before donors can see it (PRD §6.3).</p>

      {error && <ErrorState message={error} onRetry={load} />}
      {!needs && !error && (
        <>
          <Skeleton height={40} style={{ marginBottom: 8 }} />
          <Skeleton height={40} style={{ marginBottom: 8 }} />
          <Skeleton height={40} />
        </>
      )}
      {needs && needs.length === 0 && (
        <EmptyState title="You haven't posted anything yet" actionLabel="Post a need" onAction={() => navigate("/post")} />
      )}

      {needs && needs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Posted</th>
            </tr>
          </thead>
          <tbody>
            {needs.map((n) => (
              <tr key={n.id}>
                <td>
                  <button type="button" className="link-cell" onClick={() => navigate(`/needs/${n.id}`)}>
                    {n.title}
                  </button>
                </td>
                <td>{n.type}</td>
                <td>
                  <span className={`badge status-${n.status.toLowerCase()}`}>{n.status.replace("_", " ")}</span>
                </td>
                <td>{progressLabel(n) ?? "—"}</td>
                <td>{new Date(n.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
