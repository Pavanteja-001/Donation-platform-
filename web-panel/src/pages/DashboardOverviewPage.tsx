import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchMyNeeds, type Need } from "../lib/api";
import { Card, Skeleton } from "../components/ui";

export function DashboardOverviewPage() {
  const { user, token } = useAuth();
  const [needs, setNeeds] = useState<Need[] | null>(null);

  useEffect(() => {
    if (token) {
      fetchMyNeeds(token)
        .then(({ needs }) => setNeeds(needs))
        .catch(() => setNeeds([]));
    }
  }, [token]);

  const activeNeedsCount = needs ? needs.filter(n => n.status === "LIVE" || n.status === "PARTIALLY_FULFILLED").length : 0;
  const pendingVerificationCount = needs ? needs.filter(n => n.status === "PENDING_VERIFICATION").length : 0;
  const fulfilledCount = needs ? needs.filter(n => n.status === "FULFILLED").length : 0;

  return (
    <div>
      <h2>Welcome, {user?.name ?? "Institution"}</h2>
      <p className="subtitle">Here is an overview of your organization's activity.</p>

      {needs === null ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 24 }}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 24 }}>
          <Card>
            <h3>{activeNeedsCount}</h3>
            <p className="hint" style={{ margin: 0 }}>Active Needs</p>
          </Card>
          <Card>
            <h3>{pendingVerificationCount}</h3>
            <p className="hint" style={{ margin: 0 }}>Pending Verification</p>
          </Card>
          <Card>
            <h3>{fulfilledCount}</h3>
            <p className="hint" style={{ margin: 0 }}>Completed / Fulfilled</p>
          </Card>
        </div>
      )}
    </div>
  );
}
