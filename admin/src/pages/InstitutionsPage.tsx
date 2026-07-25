import { Card } from "../components/ui";

export function InstitutionsPage() {
  return (
    <div>
      <h2>Institutions</h2>
      <p className="subtitle">Verify and manage partner organizations and NGOs.</p>

      <div style={{ marginTop: 24 }}>
        <Card>
          <h3>KYC Verification Queue</h3>
          <p className="hint" style={{ marginTop: 8 }}>
            No pending institutions at this time.
          </p>
          <p className="hint" style={{ margin: 0 }}>
            The Institution KYC approval queue (D-007) will be fully implemented in Chunk 5.
          </p>
        </Card>
      </div>
    </div>
  );
}
