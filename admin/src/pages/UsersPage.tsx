import { useEffect, useState } from "react";
import { fetchUsers, type AdminUser } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";

function TableSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
      <Skeleton width="100%" height={40} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
    </div>
  );
}

export function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setError(null);
    fetchUsers(token)
      .then(({ users }) => setUsers(users))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }

  useEffect(load, [token]);

  return (
    <div>
      <h2>All users</h2>
      <p className="hint">
        Donors, beneficiaries, and institutions. Admin + Staff can both view this list (D-018).
      </p>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !users && <TableSkeleton />}
      {!error && users && users.length === 0 && (
        <EmptyState title="No users yet" subtitle="Accounts will show up here once they register." />
      )}

      {!error && users && users.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Location</th>
              <th>Trust tier</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name ?? "—"}</td>
                <td>{u.phone}</td>
                <td>
                  <span className={`badge badge-${u.role.toLowerCase()}`}>{u.role}</span>
                </td>
                <td>{[u.area, u.city].filter(Boolean).join(", ") || "—"}</td>
                <td style={{ fontWeight: 500 }}>
                  {u.trustTier.charAt(0) + u.trustTier.slice(1).toLowerCase()} · {u.confirmedContributionsCount} confirmed
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
