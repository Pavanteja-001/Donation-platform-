import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, Button } from "../components/ui";
import { CATEGORIES, TYPE_PATHS, TYPE_LABELS, type CategoryMeta, type NeedCategory } from "../lib/needCategory";
import type { NeedType } from "../lib/api";

/**
 * Posting starts with the CAUSE, not the mechanism — same model as the mobile chooser.
 *
 * The previous version listed "Money / Kit / Blood / Meal-slot / Goods / Volunteer", which is the
 * platform's internal taxonomy rather than a question an organisation asks itself. An NGO running
 * a school programme knows it is education work; whether that becomes a MONEY or KIT need is an
 * implementation detail they shouldn't have to translate before they can start.
 *
 * The mechanism is only asked when the cause genuinely allows more than one — seven of eleven
 * categories have exactly one, so most posts skip that step entirely.
 */
export function PostNeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState<NeedCategory | null>(null);

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
              <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{statusLabels[currentStatus]}</span>
            </div>
            <Button label="Check Verification Status" onClick={() => navigate("/verification-status")} />
          </Card>
        </div>
      </div>
    );
  }

  /**
   * The chosen cause travels as a query param rather than router state, so a half-filled form
   * survives a refresh and the URL is shareable — an institution passing "/post/kit?category=
   * EDUCATION" to a colleague lands them on the same form, correctly categorised.
   */
  function goToForm(category: NeedCategory, type: NeedType) {
    const path = TYPE_PATHS[type];
    if (!path) return;
    navigate(`${path}?category=${category}`);
  }

  function handleCategory(category: CategoryMeta) {
    if (category.types.length === 1) {
      goToForm(category.id, category.types[0]);
      return;
    }
    setOpen((current) => (current === category.id ? null : category.id));
  }

  return (
    <div>
      <h2>Post a need</h2>
      <p className="subtitle">Pick the area your request is about.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 24 }}>
        {CATEGORIES.map((category) => {
          const expanded = open === category.id;
          const multi = category.types.length > 1;
          return (
            <div key={category.id}>
              <div style={{ cursor: "pointer" }} onClick={() => handleCategory(category)}>
                <Card>
                  <h3 style={{ marginTop: 0, color: "var(--color-primary)" }}>
                    {category.label}
                    {/* Signals which tiles ask a second question before you tap one. */}
                    {multi ? <span style={{ float: "right", fontWeight: 400 }}>{expanded ? "▴" : "▾"}</span> : null}
                  </h3>
                  <p className="hint" style={{ margin: 0 }}>{category.hint}</p>
                </Card>
              </div>

              {expanded && (
                <div style={{ marginTop: 8, paddingLeft: 12, display: "grid", gap: 8 }}>
                  <span className="hint" style={{ fontSize: 12 }}>How would you like to receive help?</span>
                  {category.types.map((type) => (
                    <Button
                      key={type}
                      label={TYPE_LABELS[type]}
                      variant="secondary"
                      onClick={() => goToForm(category.id, type)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
