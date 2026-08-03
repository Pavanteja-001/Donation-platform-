import { useState, type FormEvent } from "react";
import { postMoneyNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryParam } from "../lib/useCategoryParam";
import { PhotoPicker } from "../components/PhotoPicker";

// PRD §7.1/§7.2 — Admin posting a money need on behalf of a beneficiary/partner org without
// their own account (D-018 — kept Admin-only, mirrors web-panel's CreateMoneyNeedPage).
export function CreateMoneyNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const category = useCategoryParam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const amount = Number(targetAmount);
    if (!amount || amount <= 0) return setError("Enter a valid target amount");

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
      await postMoneyNeed(token, { category, title, description, targetAmount: amount, upiId, photos });
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
      <h2>Post a money need</h2>
      <p className="hint">
        Posts and submits for verification immediately — you (or another admin/staff) can verify
        it from the Needs tab afterward, same as anyone else's submission.
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
          Target amount (₹)
          <input type="number" min={1} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
        </label>
        <label>
          UPI ID
          <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} required />
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
