import { useEffect, useState } from "react";
import { fetchMyNeeds, type BloodPayload, type KitPayload, type MoneyPayload, type Need } from "../lib/api";
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
  return null;
}

export function MyNeedsPage({
  onSelectNeed,
  onCreateMoney,
  onCreateKit,
  onCreateBlood,
}: {
  onSelectNeed: (id: string) => void;
  onCreateMoney: () => void;
  onCreateKit: () => void;
  onCreateBlood: () => void;
}) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchMyNeeds(token)
      .then(({ needs }) => setNeeds(needs))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your needs"));
  }, [token]);

  return (
    <div>
      <div className="page-header-row">
        <h2>Your needs</h2>
        <div className="row-actions">
          <button type="button" className="btn" onClick={onCreateMoney}>
            + Money need
          </button>
          <button type="button" className="btn" onClick={onCreateKit}>
            + Kit need
          </button>
          <button type="button" className="btn" onClick={onCreateBlood}>
            + Blood need
          </button>
        </div>
      </div>
      <p className="hint">Every need is admin-verified before donors can see it (PRD §6.3).</p>

      {error && <p className="error">{error}</p>}
      {!needs && !error && <p className="hint">Loading…</p>}

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
              <td>{progressLabel(n) ?? "—"}</td>
              <td>{new Date(n.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {needs && needs.length === 0 && (
            <tr>
              <td colSpan={5} className="hint">
                You haven't posted anything yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
