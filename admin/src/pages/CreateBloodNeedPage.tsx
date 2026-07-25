import { useState, type FormEvent } from "react";
import { postBloodNeed, uploadPhotos, type BloodGroup } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PhotoPicker } from "../components/PhotoPicker";

const BLOOD_GROUPS: BloodGroup[] = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
];

function formatGroup(g: BloodGroup) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

// PRD §8.3 — Admin posting a blood need on behalf of a beneficiary/partner org (D-018, mirrors
// web-panel's CreateBloodNeedPage / mobile's CreateBloodNeedScreen).
export function CreateBloodNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [unitsNeeded, setUnitsNeeded] = useState("1");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const units = Number(unitsNeeded);
    if (!bloodGroup) return setError("Select a blood group");
    if (!units || units <= 0) return setError("Enter how many units are needed");

    setError(null);
    setIsSubmitting(true);
    try {
      const photos = photoFiles.length > 0 ? await uploadPhotos(token, photoFiles, "need-photos") : undefined;
      await postBloodNeed(token, { title, description, bloodGroup, unitsNeeded: units, photos });
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
      <h2>Post a blood request</h2>
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

        <p className="photo-picker-label">Blood group needed</p>
        <div className="mode-row" style={{ flexWrap: "wrap" }}>
          {BLOOD_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={bloodGroup === g ? "mode-option active" : "mode-option"}
              style={{ flex: "0 1 22%", minWidth: 70 }}
              onClick={() => setBloodGroup(g)}
            >
              {formatGroup(g)}
            </button>
          ))}
        </div>

        <label>
          Units needed
          <input type="number" min={1} value={unitsNeeded} onChange={(e) => setUnitsNeeded(e.target.value)} required />
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
