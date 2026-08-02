import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "../components/ui";
import { CATEGORIES, TYPE_PATHS, TYPE_LABELS, type CategoryMeta, type NeedCategory } from "../lib/needCategory";
import type { NeedType } from "../lib/api";

/**
 * Cause first, mechanism second — the same model as the mobile chooser and the institution panel.
 *
 * Keeping all three identical matters more here than anywhere else: an admin posting on someone's
 * behalf is transcribing a request that arrived by phone or in person, and a different taxonomy on
 * this screen than in the app the caller is describing would guarantee mis-filed needs.
 */
export function PostNeedPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<NeedCategory | null>(null);

  /** Query param, not router state — the URL stays shareable and survives a refresh. */
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
      <p className="hint">
        For a beneficiary or partner organization without their own account. It goes through the
        same admin verification as any other submission — check the Needs tab afterward.
      </p>

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
                    {/* Signals which tiles ask a second question, before you tap one. */}
                    {multi ? <span style={{ float: "right", fontWeight: 400 }}>{expanded ? "▴" : "▾"}</span> : null}
                  </h3>
                  <p className="hint" style={{ margin: 0 }}>{category.hint}</p>
                </Card>
              </div>

              {expanded && (
                <div style={{ marginTop: 8, paddingLeft: 12, display: "grid", gap: 8 }}>
                  <span className="hint" style={{ fontSize: 12 }}>Which kind of request is it?</span>
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
