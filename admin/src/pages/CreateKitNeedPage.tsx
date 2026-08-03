import { useState, type FormEvent } from "react";
import { postKitNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryParam } from "../lib/useCategoryParam";
import { PhotoPicker } from "../components/PhotoPicker";

type Mode = "MONEY" | "DELIVER";

// PRD §9.1/§9.2 — Admin posting a kit need on behalf of a beneficiary/partner org (D-018 —
// Admin-only, mirrors web-panel's CreateKitNeedPage / mobile's CreateKitNeedScreen).
export function CreateKitNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const category = useCategoryParam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contents, setContents] = useState("");
  const [costPerKit, setCostPerKit] = useState("");
  const [kitsNeeded, setKitsNeeded] = useState("");
  const [mode, setMode] = useState<Mode>("MONEY");
  const [upiId, setUpiId] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const cost = Number(costPerKit);
    const kits = Number(kitsNeeded);
    if (!cost || cost <= 0) return setError("Enter a valid cost per kit");
    if (!kits || kits <= 0) return setError("Enter how many kits are needed");
    if (mode === "MONEY" && !upiId.trim()) return setError("Enter a UPI ID — donors pay per kit through it");

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
      await postKitNeed(token, { category,
        title,
        description,
        contents,
        costPerKit: cost,
        kitsNeeded: kits,
        mode,
        upiId: mode === "MONEY" ? upiId : undefined,
        photos,
      });
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
      <h2>Post a kit need</h2>
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
          What's in one kit
          <input
            type="text"
            placeholder="e.g. rice, dal, oil, soap"
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            required
          />
        </label>
        <label>
          Cost per kit (₹)
          <input type="number" min={1} value={costPerKit} onChange={(e) => setCostPerKit(e.target.value)} required />
        </label>
        <label>
          Kits needed
          <input type="number" min={1} value={kitsNeeded} onChange={(e) => setKitsNeeded(e.target.value)} required />
        </label>

        <p className="photo-picker-label">How can donors help?</p>
        <div className="mode-row">
          <button
            type="button"
            className={mode === "MONEY" ? "mode-option active" : "mode-option"}
            onClick={() => setMode("MONEY")}
          >
            Fund a kit (money)
          </button>
          <button
            type="button"
            className={mode === "DELIVER" ? "mode-option active" : "mode-option"}
            onClick={() => setMode("DELIVER")}
          >
            Buy & deliver
          </button>
        </div>
        <p className="hint">
          {mode === "MONEY"
            ? "Donors pay per kit via UPI, same as a money need."
            : "Donors pledge to buy and physically deliver kits themselves — no payment through the app."}
        </p>

        {mode === "MONEY" && (
          <label>
            UPI ID
            <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} required />
          </label>
        )}

        <PhotoPicker files={photoFiles} onChange={setPhotoFiles} />

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}
