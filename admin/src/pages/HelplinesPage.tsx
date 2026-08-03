import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createHelpline,
  deleteHelpline,
  fetchAdminHelplines,
  updateHelpline,
  type Helpline,
  type HelplineInput,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ImageCropField } from "../components/ImageCropper";
import { Card, EmptyState, ErrorState, Skeleton, useToast } from "../components/ui";

/**
 * "Safety & Emergency Support" — the helpline list in the mobile menu.
 *
 * These numbers are dialled by people in trouble, so the editing surface is deliberately blunt:
 * every field is visible at once, inactive rows stay on screen (greyed) instead of disappearing,
 * and the number is never reformatted behind an admin's back.
 */

/** Built-in icons, mirroring mobile/src/lib/helplineIcons.ts. An uploaded icon overrides these. */
const ICON_KEYS = ["heart", "ribbon", "women", "child", "shield", "ambulance", "phone", "fire", "hospital"];

const BLANK: HelplineInput = {
  name: "",
  number: "",
  category: "",
  iconKey: "phone",
  iconUrl: null,
  sortOrder: 0,
  isActive: true,
};

export function HelplinesPage() {
  const { token, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [helplines, setHelplines] = useState<Helpline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HelplineInput>(BLANK);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { helplines: list } = await fetchAdminHelplines(token);
      setHelplines(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load helplines");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setEditingId(null);
    // Land a new row at the bottom by default rather than colliding with an existing position.
    setForm({ ...BLANK, sortOrder: (helplines?.length ?? 0) + 1 });
  }

  function startEdit(helpline: Helpline) {
    setEditingId(helpline.id);
    setForm({
      name: helpline.name,
      number: helpline.number,
      category: helpline.category ?? "",
      iconKey: helpline.iconKey ?? "phone",
      iconUrl: helpline.iconUrl,
      sortOrder: helpline.sortOrder,
      isActive: helpline.isActive,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: HelplineInput = {
        ...form,
        name: form.name.trim(),
        number: form.number.trim(),
        category: form.category?.trim() || null,
      };
      if (editingId) {
        await updateHelpline(token, editingId, payload);
        showToast("Helpline updated", "success");
      } else {
        await createHelpline(token, payload);
        showToast("Helpline added", "success");
      }
      setEditingId(null);
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save helpline");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(helpline: Helpline) {
    if (!token) return;
    if (!window.confirm(`Delete "${helpline.name}" (${helpline.number})? This removes it from the app immediately.`)) {
      return;
    }
    try {
      await deleteHelpline(token, helpline.id);
      if (editingId === helpline.id) {
        setEditingId(null);
        setForm(BLANK);
      }
      showToast("Helpline deleted", "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete helpline");
    }
  }

  /** Quick on/off without opening the editor — the most common action on this page. */
  async function toggleActive(helpline: Helpline) {
    if (!token) return;
    try {
      await updateHelpline(token, helpline.id, { isActive: !helpline.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update helpline");
    }
  }

  return (
    <div>
      <h2>Safety &amp; Emergency Support</h2>
      <p className="hint">
        The helplines shown in the mobile app&apos;s menu. Tapping one in the app dials it, so check every number
        before publishing it. Inactive helplines stay here but disappear from the app.
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="community-layout" style={{ marginTop: 16 }}>
        <div>
          {!helplines ? (
            <>
              <Skeleton width="100%" height={70} />
              <Skeleton width="100%" height={70} />
              <Skeleton width="100%" height={70} />
            </>
          ) : helplines.length === 0 ? (
            <EmptyState title="No helplines yet" subtitle="Add the first one using the form." />
          ) : (
            helplines.map((helpline) => (
              <div
                key={helpline.id}
                className={[
                  "community-row",
                  editingId === helpline.id ? "is-selected" : "",
                  helpline.isActive ? "" : "is-hidden",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {helpline.iconUrl ? (
                  <img src={helpline.iconUrl} alt="" className="community-thumb community-thumb-round" />
                ) : (
                  <div className="community-thumb community-thumb-round community-thumb-placeholder">
                    {helpline.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="community-row-main">
                  <p className="community-row-title">{helpline.name}</p>
                  <p className="community-row-meta">
                    {helpline.number}
                    {helpline.category ? ` · ${helpline.category}` : ""} · position {helpline.sortOrder}
                    {helpline.isActive ? "" : " · hidden"}
                  </p>
                </div>

                {isAdmin && (
                  <div className="row-actions">
                    <button type="button" className="chip" onClick={() => toggleActive(helpline)}>
                      {helpline.isActive ? "Hide" : "Show"}
                    </button>
                    <button type="button" className="chip" onClick={() => startEdit(helpline)}>
                      Edit
                    </button>
                    <button type="button" className="btn-action-danger" onClick={() => handleDelete(helpline)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {isAdmin ? (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ marginTop: 0 }}>{editingId ? "Edit helpline" : "Add helpline"}</h3>
              {editingId ? (
                <button type="button" className="link" onClick={startNew}>
                  + New
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Women Helpline"
                  required
                />
              </label>

              <label>
                Number
                <input
                  type="text"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="181"
                  required
                />
              </label>

              <label>
                Category (optional)
                <input
                  type="text"
                  value={form.category ?? ""}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Women's safety"
                />
              </label>

              <label>
                Built-in icon
                <select value={form.iconKey ?? "phone"} onChange={(e) => setForm({ ...form, iconKey: e.target.value })}>
                  {ICON_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>

              {token ? (
                <ImageCropField
                  label="Custom icon (optional)"
                  hint="Overrides the built-in icon above. Cropped to a circle-safe square."
                  shape="square"
                  value={form.iconUrl ?? null}
                  onChange={(url) => setForm({ ...form, iconUrl: url })}
                  token={token}
                />
              ) : null}

              <label>
                Position
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder ?? 0}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>Show in the app</span>
              </label>

              <button type="submit" disabled={isSaving} style={{ marginTop: 16 }}>
                {isSaving ? "Saving…" : editingId ? "Save changes" : "Add helpline"}
              </button>
            </form>
          </Card>
        ) : (
          <Card>
            <p className="hint" style={{ margin: 0 }}>
              Staff accounts can review this list. Adding, editing or removing a helpline is an admin action.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
