import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, Button } from "../components/ui";

export function PostNeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isApproved = user?.kycStatus === "APPROVED";

  if (!isApproved) {
    const statusLabels: Record<string, string> = {
      PENDING_APPROVAL: "Pending Review",
      REJECTED: "Rejected",
      NOT_SUBMITTED: "Not Submitted",
    };
    const currentStatus = user?.kycStatus ?? "NOT_SUBMITTED";

    return (
      <div style={{ maxWidth: "560px", marginTop: "24px" }}>
        <h2>Post a need</h2>
        <p className="subtitle">Publish request needs for your organization.</p>
        
        <div style={{ marginTop: "24px" }}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-danger)" }}>Verification Required</h3>
            <p className="hint" style={{ marginBottom: "20px" }}>
              Your organization must be approved by an administrator before you can publish needs to the public feed.
            </p>
            <div style={{ marginBottom: "20px" }}>
              <span className="hint" style={{ display: "block", fontSize: "12px" }}>Current KYC Status</span>
              <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                {statusLabels[currentStatus]}
              </span>
            </div>
            <Button label="Check Verification Status" onClick={() => navigate("/verification-status")} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Post a need</h2>
      <p className="subtitle">Select the type of need you want to publish for your organization.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 24 }}>
        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/money")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Money need</h3>
            <p className="hint" style={{ margin: 0 }}>Raise funds for emergency, education, or healthcare support via UPI.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/kit")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Kit need</h3>
            <p className="hint" style={{ margin: 0 }}>Request grocery, education, or medical kits (either funded or deliver-only).</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/blood")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Blood need</h3>
            <p className="hint" style={{ margin: 0 }}>Request blood donors for critical or emergency requirements matching blood groups.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/meal-slot")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Meal-slot need</h3>
            <p className="hint" style={{ margin: 0 }}>Request bookings for orphanage or shelter meals on specific dates.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/goods")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Goods need</h3>
            <p className="hint" style={{ margin: 0 }}>Request unused items or equipment (e.g. books, blankets, clothes).</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/skill-request")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Volunteer need</h3>
            <p className="hint" style={{ margin: 0 }}>Request skilled volunteers for an event, camp, or task at your organization.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
