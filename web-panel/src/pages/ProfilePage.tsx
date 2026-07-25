import { useAuth } from "../context/AuthContext";
import { Avatar, Card, Button } from "../components/ui";

export function ProfilePage() {
  const { user, signOut } = useAuth();

  return (
    <div>
      <h2>Profile</h2>
      <p className="subtitle">Manage your institution profile.</p>

      <div style={{ maxWidth: 480, marginTop: 24 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <Avatar name={user?.name} size={64} />
            <div>
              <h3 style={{ margin: 0 }}>{user?.name ?? "Institution"}</h3>
              <p className="hint" style={{ margin: 0 }}>Role: {user?.role}</p>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Phone Number</label>
            <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{user?.phone}</p>
          </div>

          <Button label="Log out" variant="danger" onClick={signOut} />
        </Card>
      </div>
    </div>
  );
}
