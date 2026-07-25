import { useEffect, useState, type FormEvent } from "react";
import { createStaff, deleteStaff, fetchStaff, type StaffAccount } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add staff"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

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
          {staff?.map((s) => (
            <tr key={s.id}>
              <td>{s.name ?? "—"}</td>
              <td>{s.phone}</td>
              <td>{new Date(s.createdAt).toLocaleDateString()}</td>
              <td>
                <button type="button" className="link danger" onClick={() => handleDelete(s.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {staff && staff.length === 0 && (
            <tr>
              <td colSpan={4} className="hint">
                No staff accounts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
