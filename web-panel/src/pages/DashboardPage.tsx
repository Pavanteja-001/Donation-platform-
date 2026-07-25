import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>DonationPlatform — Institution Panel</h1>
          <p className="subtitle">
            {user?.name ?? "Institution"} · {user?.phone} · role {user?.role}
          </p>
        </div>
        <button type="button" className="link" onClick={() => signOut()}>
          Log out
        </button>
      </header>
      <main>
        <p>
          KYC onboarding (D-007), request posting, and the live status feed (D-008) land in later
          milestones. This screen confirms institution auth + role loading end-to-end.
        </p>
      </main>
    </div>
  );
}
