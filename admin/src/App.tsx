import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { StaffPage } from "./pages/StaffPage";

type Tab = "users" | "staff";

function Console() {
  const { user, isAdmin, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="console">
      <header className="console-header">
        <div>
          <h1>DonationPlatform Admin</h1>
          <p className="subtitle">
            {user?.name ?? "Admin"} · {user?.phone} · role {user?.role}
          </p>
        </div>
        <button type="button" className="link" onClick={() => signOut()}>
          Log out
        </button>
      </header>

      <nav className="console-nav">
        <button
          type="button"
          className={tab === "users" ? "tab active" : "tab"}
          onClick={() => setTab("users")}
        >
          All users
        </button>
        {/* Staff management is ADMIN-only (D-018) — Staff never even see the tab. */}
        {isAdmin && (
          <button
            type="button"
            className={tab === "staff" ? "tab active" : "tab"}
            onClick={() => setTab("staff")}
          >
            Staff accounts
          </button>
        )}
      </nav>

      <main className="console-main">{tab === "staff" && isAdmin ? <StaffPage /> : <UsersPage />}</main>
    </div>
  );
}

function Root() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="loading">Loading…</div>;
  return user ? <Console /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
