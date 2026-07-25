import { useEffect, useState } from "react";
import { fetchMyNeeds, type MoneyPayload, type Need } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

export function MyNeedsPage({ onSelectNeed, onCreate }: { onSelectNeed: (id: string) => void; onCreate: () => void }) {
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
        <button type="button" className="btn" onClick={onCreate}>
          + Post a money need
        </button>
      </div>
      <p className="hint">Every need is admin-verified before donors can see it (PRD §6.3).</p>

      {error && <p className="error">{error}</p>}
      {!needs && !error && <p className="hint">Loading…</p>}

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Posted</th>
          </tr>
        </thead>
        <tbody>
          {needs?.map((n) => {
            const money = isMoneyPayload(n.payload) ? n.payload : null;
            return (
              <tr key={n.id}>
                <td>
                  <button type="button" className="link-cell" onClick={() => onSelectNeed(n.id)}>
                    {n.title}
                  </button>
                </td>
                <td>
                  <span className={`badge status-${n.status.toLowerCase()}`}>{n.status.replace("_", " ")}</span>
                </td>
                <td>
                  {money ? `₹${money.raised_amount.toLocaleString("en-IN")} / ₹${money.target_amount.toLocaleString("en-IN")}` : "—"}
                </td>
                <td>{new Date(n.createdAt).toLocaleDateString()}</td>
              </tr>
            );
          })}
          {needs && needs.length === 0 && (
            <tr>
              <td colSpan={4} className="hint">
                You haven't posted anything yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
