import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createSuccessStory,
  deleteSuccessStory,
  fetchAdminSuccessStories,
  updateSuccessStory,
  uploadCommunityImage,
  type SuccessStory,
  type SuccessStoryInput,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ImageCropField, CROP_SHAPES } from "../components/ImageCropper";
import { Card, EmptyState, ErrorState, Skeleton, useToast } from "../components/ui";

/**
 * "Success Stories" — the carousel in the mobile menu and the story pages behind it.
 *
 * The three fields are not interchangeable and the form says so:
 *   title   — the headline on the list card and the detail page
 *   summary — the sentence or two that fit on the small carousel card
 *   body    — the full write-up behind "Read more"
 * Letting an admin paste the whole story into `summary` is what produces a carousel card of
 * truncated text with no ending, so the limits are enforced here as well as server-side.
 */

const SUMMARY_LIMIT = 280;

const BLANK: SuccessStoryInput = {
  title: "",
  summary: "",
  body: "",
  coverImageUrl: null,
  images: [],
  beneficiaryName: "",
  isPublished: true,
  sortOrder: 0,
};

export function SuccessStoriesPage() {
  const { token, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [stories, setStories] = useState<SuccessStory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SuccessStoryInput>(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { stories: list } = await fetchAdminSuccessStories(token);
      setStories(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stories");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setEditingId(null);
    setForm({ ...BLANK, sortOrder: (stories?.length ?? 0) + 1 });
  }

  function startEdit(story: SuccessStory) {
    setEditingId(story.id);
    setForm({
      title: story.title,
      summary: story.summary,
      body: story.body,
      coverImageUrl: story.coverImageUrl,
      images: story.images,
      beneficiaryName: story.beneficiaryName ?? "",
      relatedNeedId: story.relatedNeedId ?? "",
      isPublished: story.isPublished,
      sortOrder: story.sortOrder,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: SuccessStoryInput = {
        ...form,
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        beneficiaryName: form.beneficiaryName?.trim() || null,
        relatedNeedId: form.relatedNeedId?.trim() || null,
      };
      if (editingId) {
        await updateSuccessStory(token, editingId, payload);
        showToast("Story updated", "success");
      } else {
        await createSuccessStory(token, payload);
        showToast("Story published", "success");
      }
      setEditingId(null);
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save story");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(story: SuccessStory) {
    if (!token) return;
    if (!window.confirm(`Delete "${story.title}"? This cannot be undone.`)) return;
    try {
      await deleteSuccessStory(token, story.id);
      if (editingId === story.id) {
        setEditingId(null);
        setForm(BLANK);
      }
      showToast("Story deleted", "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete story");
    }
  }

  async function togglePublished(story: SuccessStory) {
    if (!token) return;
    try {
      await updateSuccessStory(token, story.id, { isPublished: !story.isPublished });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update story");
    }
  }

  /**
   * Gallery photos go through the same crop as the cover.
   *
   * The detail page lays them out at one fixed width, so a portrait photo dropped in raw would
   * be letterboxed against grey while the ones around it fill their frame.
   */
  async function handleAddPhoto(file: File) {
    if (!token) return;
    setIsAddingPhoto(true);
    setError(null);
    try {
      const blob = await cropToShape(file, "cover");
      const url = await uploadCommunityImage(token, blob);
      setForm((current) => ({ ...current, images: [...(current.images ?? []), url] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add photo");
    } finally {
      setIsAddingPhoto(false);
    }
  }

  const summaryLength = form.summary.length;

  return (
    <div>
      <h2>Success Stories</h2>
      <p className="hint">
        Stories shown in the mobile app&apos;s menu carousel and on their own pages. Unpublished stories stay here but
        disappear from the app.
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="community-layout" style={{ marginTop: 16 }}>
        <div>
          {!stories ? (
            <>
              <Skeleton width="100%" height={80} />
              <Skeleton width="100%" height={80} />
            </>
          ) : stories.length === 0 ? (
            <EmptyState title="No stories yet" subtitle="Write the first one using the form." />
          ) : (
            stories.map((story) => (
              <div
                key={story.id}
                className={[
                  "community-row",
                  editingId === story.id ? "is-selected" : "",
                  story.isPublished ? "" : "is-hidden",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt="" className="community-thumb" />
                ) : (
                  <div className="community-thumb community-thumb-placeholder">★</div>
                )}

                <div className="community-row-main">
                  <p className="community-row-title">{story.title}</p>
                  <p className="community-row-meta">
                    {story.beneficiaryName ? `${story.beneficiaryName} · ` : ""}
                    {story.images.length} photo{story.images.length === 1 ? "" : "s"} · position {story.sortOrder}
                    {story.isPublished ? "" : " · unpublished"}
                  </p>
                </div>

                {isAdmin && (
                  <div className="row-actions">
                    <button type="button" className="chip" onClick={() => togglePublished(story)}>
                      {story.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" className="chip" onClick={() => startEdit(story)}>
                      Edit
                    </button>
                    <button type="button" className="btn-action-danger" onClick={() => handleDelete(story)}>
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
              <h3 style={{ marginTop: 0 }}>{editingId ? "Edit story" : "New story"}</h3>
              {editingId ? (
                <button type="button" className="link" onClick={startNew}>
                  + New
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Kavya is back to school"
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Card summary ({summaryLength}/{SUMMARY_LIMIT})
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Thanks to your support, Kavya is back to school and dreaming big!"
                  maxLength={SUMMARY_LIMIT}
                  required
                />
              </label>

              <label>
                Full story
                <textarea
                  rows={8}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="What the need was, what donors did, and what changed."
                  required
                />
              </label>

              {token ? (
                <ImageCropField
                  label="Cover image"
                  hint="Shown on the carousel card and at the top of the story."
                  shape="cover"
                  value={form.coverImageUrl ?? null}
                  onChange={(url) => setForm({ ...form, coverImageUrl: url })}
                  token={token}
                />
              ) : null}

              <div className="crop-field">
                <label className="photo-picker-label">Story photos ({(form.images ?? []).length})</label>
                <p className="crop-field-hint">
                  Cropped to {CROP_SHAPES.cover.label} so the gallery renders evenly on the story page.
                </p>
                <div className="community-gallery">
                  {(form.images ?? []).map((url) => (
                    <div key={url} className="community-gallery-item">
                      <img src={url} alt="" />
                      <button
                        type="button"
                        className="photo-remove-badge"
                        onClick={() => setForm({ ...form, images: (form.images ?? []).filter((u) => u !== url) })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="photo-add-tile" style={{ display: "grid", placeItems: "center", cursor: "pointer" }}>
                    {isAddingPhoto ? "…" : "+ Add"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void handleAddPhoto(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <label>
                Person featured (optional)
                <input
                  type="text"
                  value={form.beneficiaryName ?? ""}
                  onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                  placeholder="Kavya"
                />
              </label>
              <p className="hint" style={{ marginTop: -10 }}>
                Only name someone who agreed to be named. Leave blank to tell the story without identifying them.
              </p>

              <label>
                Related need ID (optional)
                <input
                  type="text"
                  value={form.relatedNeedId ?? ""}
                  onChange={(e) => setForm({ ...form, relatedNeedId: e.target.value })}
                  placeholder="cmsd…"
                />
              </label>

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
                  checked={form.isPublished ?? true}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                />
                <span>Publish to the app</span>
              </label>

              <button type="submit" disabled={isSaving} style={{ marginTop: 16 }}>
                {isSaving ? "Saving…" : editingId ? "Save changes" : "Publish story"}
              </button>
            </form>
          </Card>
        ) : (
          <Card>
            <p className="hint" style={{ margin: 0 }}>
              Staff accounts can review published stories. Writing and editing them is an admin action.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Centre-crop a file to a shape without opening the editor.
 *
 * Used for gallery photos, where an admin is adding several at once and a modal per photo would
 * be four dialogs deep. The cover image — the one that actually has to frame a face — still goes
 * through the interactive cropper.
 */
async function cropToShape(file: File, shape: keyof typeof CROP_SHAPES): Promise<Blob> {
  const { aspect, width, height } = CROP_SHAPES[shape];
  const bitmap = await createImageBitmap(file);
  const sourceAspect = bitmap.width / bitmap.height;

  // Take the largest centred rectangle of the right aspect: crop the sides of a wide photo, the
  // top and bottom of a tall one.
  const cropWidth = sourceAspect > aspect ? bitmap.height * aspect : bitmap.width;
  const cropHeight = sourceAspect > aspect ? bitmap.height : bitmap.width / aspect;
  const sx = (bitmap.width - cropWidth) / 2;
  const sy = (bitmap.height - cropHeight) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  ctx.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))),
      "image/webp",
      0.9
    );
  });
}
