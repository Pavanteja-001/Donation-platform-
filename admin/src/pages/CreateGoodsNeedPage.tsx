import { useState, type FormEvent } from "react";
import { postGoodsNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryParam } from "../lib/useCategoryParam";
import { PhotoPicker } from "../components/PhotoPicker";

// PRD §11.1/§11.2 — Admin posting a goods need on behalf of a beneficiary/partner org (D-018,
// mirrors web-panel's CreateGoodsNeedPage / mobile's CreateGoodsNeedScreen).
export function CreateGoodsNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const category = useCategoryParam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [item, setItem] = useState("");
  const [condition, setCondition] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!item.trim()) return setError("Describe the item needed");
    if (!condition.trim()) return setError("Describe an acceptable condition (e.g. new, gently used)");

    setError(null);
    setIsSubmitting(true);
    try {
      // Mirrors the server rule on POST /needs/:id/submit — a need going out for verification
      // has to carry something an admin can actually look at.
      if (photoFiles.length === 0) {
        setError("Add at least one photo — it's what lets an admin verify this request");
        return;
      }
      const photos = await uploadPhotos(token, photoFiles, "need-photos");
      await postGoodsNeed(token, { category, title, description, item, condition, photos });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" className="link" onClick={onBack}>
        ‹ Back
      </button>
      <h2>Post a goods need</h2>
      <p className="hint">
        Posts and submits for verification immediately — verify it from the Needs tab afterward,
        same as anyone else's submission.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
        </label>
        <label>
          Item (e.g. manual wheelchair, adult size)
          <input type="text" value={item} onChange={(e) => setItem(e.target.value)} required />
        </label>
        <label>
          Acceptable condition
          <input type="text" value={condition} onChange={(e) => setCondition(e.target.value)} required />
        </label>

        <PhotoPicker files={photoFiles} onChange={setPhotoFiles} />

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}
