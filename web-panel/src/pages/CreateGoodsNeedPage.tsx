import { useState, type FormEvent } from "react";
import { postGoodsNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker } from "../components/PhotoPicker";

// PRD §11.1/§11.2 — post a GOODS need. Links to **this** institution automatically (D-008), same
// reasoning as blood/meal-slot — an orphanage/NGO posting its own request can fast-track-verify
// it themselves afterward (NeedDetailPage), rather than waiting on admin.
export function CreateGoodsNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token, user } = useAuth();
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
    if (!item.trim()) return setError("Describe the item you need");
    if (!condition.trim()) return setError("Describe an acceptable condition (e.g. new, gently used)");

    setError(null);
    setIsSubmitting(true);
    try {
      const photos = photoFiles.length > 0 ? await uploadPhotos(token, photoFiles, "need-photos") : undefined;
      await postGoodsNeed(token, { title, description, item, condition, linkedInstitutionId: user?.id, photos });
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
        Linked to your institution — you can verify it yourself afterward to fast-track it
        (D-008), without waiting on admin.
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
