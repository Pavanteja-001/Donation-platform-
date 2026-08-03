import { useState, type FormEvent } from "react";
import { postMealSlotNeed, uploadPhotos } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryParam } from "../lib/useCategoryParam";
import { PhotoPicker } from "../components/PhotoPicker";

type Mode = "MONEY" | "DELIVER";

// PRD §10.1/§10.2 — Admin posting a meal-slot need on behalf of a beneficiary/partner org
// (D-018, mirrors web-panel's CreateMealSlotNeedPage / mobile's CreateMealSlotNeedScreen).
export function CreateMealSlotNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const category = useCategoryParam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState("");
  const [costPerSlot, setCostPerSlot] = useState("");
  const [mode, setMode] = useState<Mode>("MONEY");
  const [upiId, setUpiId] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAddDate() {
    if (!dateInput) return;
    if (dates.includes(dateInput)) return setError("That date is already in the list");
    if (dates.length >= 60) return setError("A meal-slot need can have at most 60 dates");
    setError(null);
    setDates((prev) => [...prev, dateInput].sort());
    setDateInput("");
  }

  function handleRemoveDate(d: string) {
    setDates((prev) => prev.filter((x) => x !== d));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const cost = Number(costPerSlot);
    if (!mealType.trim()) return setError("Describe the meal (e.g. breakfast, lunch)");
    if (!cost || cost <= 0) return setError("Enter a valid cost per slot");
    if (mode === "MONEY" && !upiId.trim()) return setError("Enter a UPI ID — donors pay per slot through it");
    if (dates.length === 0) return setError("Add at least one date");

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
      await postMealSlotNeed(token, { category,
        title,
        description,
        mealType,
        costPerSlot: cost,
        mode,
        upiId: mode === "MONEY" ? upiId : undefined,
        dates,
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
      <h2>Post a meal-slot need</h2>
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
          Meal (e.g. breakfast, lunch, dinner)
          <input type="text" value={mealType} onChange={(e) => setMealType(e.target.value)} required />
        </label>
        <label>
          Cost per slot (₹)
          <input type="number" min={1} value={costPerSlot} onChange={(e) => setCostPerSlot(e.target.value)} required />
        </label>

        <p className="photo-picker-label">How can donors help?</p>
        <div className="mode-row">
          <button
            type="button"
            className={mode === "MONEY" ? "mode-option active" : "mode-option"}
            onClick={() => setMode("MONEY")}
          >
            Fund a slot (money)
          </button>
          <button
            type="button"
            className={mode === "DELIVER" ? "mode-option active" : "mode-option"}
            onClick={() => setMode("DELIVER")}
          >
            Cook & serve in person
          </button>
        </div>
        <p className="hint">
          {mode === "MONEY"
            ? "Donors pay per slot via UPI, same as a money need."
            : "Donors pledge to personally cook/serve that date — no payment through the app."}
        </p>

        {mode === "MONEY" && (
          <label>
            UPI ID
            <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} required />
          </label>
        )}

        <p className="photo-picker-label">Bookable dates</p>
        <div className="row-actions">
          <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          <button type="button" className="btn" onClick={handleAddDate}>
            Add date
          </button>
        </div>
        {dates.length > 0 && (
          <p className="hint">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                className="mode-option"
                style={{ marginRight: 6, marginTop: 6 }}
                onClick={() => handleRemoveDate(d)}
              >
                {d} ✕
              </button>
            ))}
          </p>
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
