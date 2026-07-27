import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics, type AnalyticsData } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, ErrorState } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

// PRD §21 / Admin Console §15 — Platform Analytics & Metrics Overview
export function AnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAnalytics(token);
      setData(res.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform analytics");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div>
        <h2>Analytics &amp; Metrics</h2>
        <PageSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h2>Analytics &amp; Metrics</h2>
        <ErrorState message={error ?? "No analytics data available"} onRetry={load} />
      </div>
    );
  }

  return (
    <div>
      <h2>Analytics &amp; Metrics</h2>
      <p className="hint">Live overview of platform participation, giving metrics, and fulfillment performance.</p>

      {/* Main KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Total Money Raised</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-primary)", marginTop: 6 }}>
            ₹{data.totalMoneyRaised.toLocaleString("en-IN")}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Care Kits Funded</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-primary)", marginTop: 6 }}>
            {data.totalKitsFunded.toLocaleString()} kits
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Blood Units Fulfilled</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-danger)", marginTop: 6 }}>
            {data.totalBloodUnitsFulfilled.toLocaleString()} units
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Meal Slots Booked</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-primary)", marginTop: 6 }}>
            {data.totalMealSlotsConfirmed.toLocaleString()} slots
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Volunteers Pledged</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-primary)", marginTop: 6 }}>
            {data.totalVolunteersPledged.toLocaleString()} volunteers
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Confirmed Contributions</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 6 }}>
            {data.totalConfirmedContributions.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Platform Activity Overview Grid */}
      <h3 style={{ marginTop: 32, marginBottom: 16 }}>Platform Participation</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Registered Donors</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 4 }}>
            {data.totalUsers.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Verified Institutions</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 4 }}>
            {data.totalInstitutions.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Total Needs Posted</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 4 }}>
            {data.totalNeeds.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Currently Live Needs</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginTop: 4 }}>
            {data.totalLiveNeeds.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 600 }}>Fully Fulfilled Needs</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", marginTop: 4 }}>
            {data.totalFulfilledNeeds.toLocaleString()}
          </div>
        </Card>
      </div>
    </div>
  );
}
