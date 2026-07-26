import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui";

export function PostNeedPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h2>Post a need</h2>
      <p className="hint">
        For a beneficiary or partner organization without their own account. It goes through the
        same admin verification as any other submission — check the Needs tab afterward.
      </p>

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
            <p className="hint" style={{ margin: 0 }}>Request grocery, education, or medical kits.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/blood")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Blood need</h3>
            <p className="hint" style={{ margin: 0 }}>Request blood donors for critical/emergency requirements.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/meal-slot")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Meal-slot need</h3>
            <p className="hint" style={{ margin: 0 }}>Request bookings for orphanage or shelter meals.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/goods")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Goods need</h3>
            <p className="hint" style={{ margin: 0 }}>Request unused items or equipment.</p>
          </Card>
        </div>

        <div style={{ cursor: "pointer" }} onClick={() => navigate("/post/skill-request")}>
          <Card>
            <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>+ Volunteer need</h3>
            <p className="hint" style={{ margin: 0 }}>Request skilled volunteers for an event, camp, or task.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
