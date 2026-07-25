import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui";

export function PostNeedPage() {
  const navigate = useNavigate();

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
      </div>
    </div>
  );
}
