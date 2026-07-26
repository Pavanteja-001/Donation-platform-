import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyNeeds,
  type BloodPayload,
  type GoodsPayload,
  type KitPayload,
  type MealSlotPayload,
  type MoneyPayload,
  type SkillRequestPayload,
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

function isSkillRequestPayload(payload: Need["payload"]): payload is SkillRequestPayload {
  return !!payload && typeof (payload as SkillRequestPayload).volunteers_needed === "number";
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
  if (need.type === "SKILL_REQUEST" && isSkillRequestPayload(need.payload)) {
    return `${need.payload.volunteers_joined} / ${need.payload.volunteers_needed} volunteers`;
  }
  return null;
}

function TableSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
      <Skeleton width="100%" height={40} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
    </div>
  );
}

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
      {!needs && !error && <TableSkeleton />}
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
                  <button type="button" className="link-cell" onClick={() => navigate(`/needs/${n.id}`)} style={{ fontWeight: 600 }}>
                    {n.title}
                  </button>
                </td>
                <td style={{ fontWeight: 500 }}>{n.type}</td>
                <td>
                  <span className={`badge status-${n.status.toLowerCase()}`}>{n.status.replace("_", " ")}</span>
                </td>
                <td style={{ fontWeight: 500 }}>{progressLabel(n) ?? "—"}</td>
                <td>{new Date(n.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
