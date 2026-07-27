import { useState } from "react";
import { postSkillRequestNeed } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { CreateNeedScaffold } from "../components/CreateNeedScaffold";
import { Input } from "../components/ui";

// PRD §13 — post a SKILL_REQUEST need (scribe, mentor, event volunteer).
export function CreateSkillRequestNeedScreen({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
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

  async function handleSubmit() {
    if (!token) return;
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!roleNeeded.trim()) return setError("Describe the role or skill you need");
    const numVolunteers = parseInt(volunteersNeeded, 10);
    if (isNaN(numVolunteers) || numVolunteers < 1) return setError("Enter a valid number of volunteers needed");
    if (!date.trim()) return setError("Enter the date (YYYY-MM-DD)");
    if (!time.trim()) return setError("Enter the time (HH:MM)");

    setError(null);
    setIsSubmitting(true);
    try {
      await postSkillRequestNeed(token, {
        title: title.trim(),
        description: description.trim(),
        role_needed: roleNeeded.trim(),
        volunteers_needed: numVolunteers,
        date: date.trim(),
        time: time.trim(),
        city: city.trim() || undefined,
        area: area.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CreateNeedScaffold
      type="SKILL_REQUEST"
      title="Request volunteers"
      subtitle="Ask for skilled help — a scribe, a mentor, or hands at an event."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Post volunteering need"
    >
      <Input
        label="Title"
        placeholder="e.g. Volunteers needed for blood camp"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe the task, who it helps, and what's involved"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      <Input
        label="Role / skill needed"
        placeholder="e.g. Medical volunteer, driver, organiser"
        icon="tool"
        value={roleNeeded}
        onChangeText={(txt) => {
          setRoleNeeded(txt);
          setError(null);
        }}
      />

      <Input
        label="Number of volunteers"
        placeholder="1"
        icon="users"
        keyboardType="number-pad"
        value={volunteersNeeded}
        onChangeText={(txt) => {
          setVolunteersNeeded(txt);
          setError(null);
        }}
      />

      <Input
        label="Date"
        placeholder="2026-12-31"
        icon="calendar"
        helper="Format: YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        value={date}
        onChangeText={(txt) => {
          setDate(txt);
          setError(null);
        }}
      />

      <Input
        label="Time"
        placeholder="09:00"
        icon="clock"
        helper="Format: HH:MM"
        value={time}
        onChangeText={(txt) => {
          setTime(txt);
          setError(null);
        }}
      />

      <Input label="City" placeholder="Hyderabad" icon="map-pin" helper="Optional" value={city} onChangeText={setCity} />

      <Input label="Area" placeholder="Gachibowli" icon="navigation" helper="Optional" value={area} onChangeText={setArea} />
    </CreateNeedScaffold>
  );
}
