import { Card } from "../components/ui";

export function VerificationStatusPage() {
  return (
    <div>
      <h2>Verification status</h2>
      <p className="subtitle">Track your organization's KYC verification status.</p>

      <div style={{ marginTop: 24 }}>
        <Card>
          <h3>Status: APPROVED</h3>
          <p className="hint" style={{ marginTop: 8 }}>
            Your institution has been approved. You can post needs to the public feed.
          </p>
          <p className="hint" style={{ margin: 0 }}>
            KYC verification onboarding (D-007) will be fully implemented in Chunk 4.
          </p>
        </Card>
      </div>
    </div>
  );
}
