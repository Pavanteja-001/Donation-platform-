import { useState, type FormEvent } from "react";
import { postSkillRequestNeed } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryParam } from "../lib/useCategoryParam";

// PRD §13 — post a SKILL_REQUEST need. Linked to this institution automatically (D-008) so it
// can fast-track-verify itself afterward in NeedDetailPage, same as Blood/Meal-slot/Goods.
export function CreateSkillRequestNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token, user } = useAuth();
  const category = useCategoryParam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleNeeded, setRoleNeeded] = useState("");
  const [volunteersNeeded, setVolunteersNeeded] = useState("1");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const numVolunteers = parseInt(volunteersNeeded, 10);
    if (isNaN(numVolunteers) || numVolunteers < 1) return setError("Enter a valid number of volunteers (≥ 1)");
    if (!roleNeeded.trim()) return setError("Describe the role or skill needed");
    if (!date.trim()) return setError("Enter the date (YYYY-MM-DD)");
    if (!time.trim()) return setError("Enter the time (HH:MM)");

    setError(null);
    setIsSubmitting(true);
    try {
      await postSkillRequestNeed(token, { category,
        title: title.trim(),
        description: description.trim(),
        role_needed: roleNeeded.trim(),
        volunteers_needed: numVolunteers,
        date: date.trim(),
        time: time.trim(),
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        linkedInstitutionId: user?.id,
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
      <h2>Post a volunteering need</h2>
      <p className="hint">
        Linked to your institution — you can verify it yourself afterward to fast-track it (D-008),
        without waiting on admin.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="E.g., Medical volunteers for blood camp" />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required placeholder="Describe what volunteers will do…" />
        </label>
        <label>
          Role / Skill needed
          <input type="text" value={roleNeeded} onChange={(e) => setRoleNeeded(e.target.value)} required placeholder="E.g., Medical volunteer, Driver, Organiser" />
        </label>
        <label>
          Number of volunteers needed
          <input type="number" min={1} value={volunteersNeeded} onChange={(e) => setVolunteersNeeded(e.target.value)} required />
        </label>
        <label>
          Date (YYYY-MM-DD)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Time (HH:MM)
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          City <span className="hint">(optional)</span>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Hyderabad" />
        </label>
        <label>
          Area <span className="hint">(optional)</span>
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Gachibowli" />
        </label>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}
