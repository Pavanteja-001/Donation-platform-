import { useEffect, useState, type FormEvent } from "react";
import { createStaff, deleteStaff, fetchStaff, type StaffAccount } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, Skeleton, Button, Input } from "../components/ui";

function TableSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
      <Skeleton width="100%" height={40} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
      <Skeleton width="100%" height={32} style={{ borderRadius: "4px" }} />
    </div>
  );
}

// ADMIN-only page (see App.tsx nav gating) — manage Staff logins per D-018.
export function StaffPage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    if (!token) return;
    fetchStaff(token)
      .then(({ staff }) => setStaff(staff))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load staff"));
  }

  useEffect(load, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await createStaff(token, phone, name);
      setPhone("");
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await deleteStaff(token, id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove staff account");
    }
  }

  return (
    <div>
      <h2>Staff accounts</h2>
      <p className="hint">
        Staff can verify/accept needs and list users, but can't edit users/settings, manage staff,
        or override confirmed donations (D-018).
      </p>

      <form className="inline-form" onSubmit={handleCreate} style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "24px", marginTop: "16px" }}>
        <Input
          label="Phone number"
          type="tel"
          placeholder="e.g. +919999999999"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          style={{ width: "240px" }}
        />
        <Input
          label="Full Name"
          type="text"
          placeholder="e.g. Ramesh Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ width: "240px" }}
        />
        <Button type="submit" label={isSubmitting ? "Adding…" : "Add staff"} loading={isSubmitting} style={{ height: "40px" }} />
      </form>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !staff && <TableSkeleton />}
      {!error && staff && staff.length === 0 && (
        <EmptyState title="No staff accounts yet" subtitle="Created staff logins will show up here." />
      )}

      {!error && staff && staff.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name ?? "—"}</td>
                <td>{s.phone}</td>
                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                <td>
                  <button type="button" className="link danger" onClick={() => handleDelete(s.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
