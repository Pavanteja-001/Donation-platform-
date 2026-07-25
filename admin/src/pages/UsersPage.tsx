import { useEffect, useState } from "react";
import { fetchUsers, type AdminUser } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchUsers(token)
      .then(({ users }) => setUsers(users))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!users) return <p className="hint">Loading users…</p>;

  return (
    <div>
      <h2>All users</h2>
      <p className="hint">
        Donors, beneficiaries, and institutions. Admin + Staff can both view this list (D-018).
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Location</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name ?? "—"}</td>
              <td>{u.phone}</td>
              <td>
                <span className={`badge badge-${u.role.toLowerCase()}`}>{u.role}</span>
              </td>
              <td>{[u.area, u.city].filter(Boolean).join(", ") || "—"}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="hint">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
