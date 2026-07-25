import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { StaffPage } from "./pages/StaffPage";
import { NeedsPage } from "./pages/NeedsPage";
import { NeedDetailPage } from "./pages/NeedDetailPage";
import { PostNeedPage } from "./pages/PostNeedPage";
import { ToastProvider } from "./components/ui";

type Tab = "needs" | "post" | "users" | "staff";

function Console() {
  const { user, isAdmin, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("needs");
  const [selectedNeedId, setSelectedNeedId] = useState<string | null>(null);

  function goToTab(next: Tab) {
    setTab(next);
    setSelectedNeedId(null);
  }

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
        <button type="button" className={tab === "needs" ? "tab active" : "tab"} onClick={() => goToTab("needs")}>
          Needs
        </button>
        {/* Posting on behalf of a beneficiary/org without their own account is Admin-only
            (D-018) — kept consistent with Staff's limited feature set (verify/accept + list
            users only), not a new capability opened up to them. */}
        {isAdmin && (
          <button type="button" className={tab === "post" ? "tab active" : "tab"} onClick={() => goToTab("post")}>
            Post a need
          </button>
        )}
        <button type="button" className={tab === "users" ? "tab active" : "tab"} onClick={() => goToTab("users")}>
          All users
        </button>
        {/* Staff management is ADMIN-only (D-018) — Staff never even see the tab. */}
        {isAdmin && (
          <button type="button" className={tab === "staff" ? "tab active" : "tab"} onClick={() => goToTab("staff")}>
            Staff accounts
          </button>
        )}
      </nav>

      <main className="console-main">
        {tab === "needs" &&
          (selectedNeedId ? (
            <NeedDetailPage needId={selectedNeedId} onBack={() => setSelectedNeedId(null)} />
          ) : (
            <NeedsPage onSelectNeed={setSelectedNeedId} />
          ))}
        {tab === "post" && isAdmin && <PostNeedPage />}
        {tab === "users" && <UsersPage />}
        {tab === "staff" && isAdmin && <StaffPage />}
      </main>
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
      <ToastProvider>
        <Root />
      </ToastProvider>
    </AuthProvider>
  );
}
