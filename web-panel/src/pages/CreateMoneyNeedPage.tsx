import { useState, type FormEvent } from "react";
import { postMoneyNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker } from "../components/PhotoPicker";

// PRD §7.1/§7.2 — post a MONEY need with optional photos (D-021).
export function CreateMoneyNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
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
      const photos = photoFiles.length > 0 ? await uploadPhotos(token, photoFiles, "need-photos") : undefined;
      await postMoneyNeed(token, { title, description, targetAmount: amount, upiId, photos });
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
      <p className="hint">An admin verifies every need before it goes live (PRD §6.3).</p>
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
