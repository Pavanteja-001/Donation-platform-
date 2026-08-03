import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createEvent,
  deleteEvent,
  fetchAdminEvents,
  updateEvent,
  type PlatformEvent,
  type PlatformEventInput,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ImageCropField } from "../components/ImageCropper";
import { Card, EmptyState, ErrorState, Skeleton, useToast } from "../components/ui";

/**
 * "Upcoming Events" — health camps, workshops and drives posted by the platform.
 *
 * Whether an event is upcoming or past is derived from its dates, never set by hand: an admin who
 * has to remember to move an event to "past" will not, and the app would keep advertising a camp
 * that happened last month.
 */

const BLANK: PlatformEventInput = {
  title: "",
  description: "",
  eventType: "",
  mode: "OFFLINE",
  location: "",
  address: "",
  startsAt: "",
  endsAt: "",
  bannerUrl: null,
  iconUrl: null,
  registrationUrl: "",
  contactPhone: "",
  isPublished: true,
};

/**
 * `<input type="datetime-local">` speaks local wall-clock time with no zone; the API wants a real
 * instant. These two convert across that boundary — getting it wrong is how an event drifts by
 * five and a half hours.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function whenLabel(event: PlatformEvent): string {
  const start = new Date(event.startsAt);
  const isPast = new Date(event.endsAt ?? event.startsAt) < new Date();
  return `${start.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${isPast ? " · past" : ""}`;
}

export function EventsPage() {
  const { token, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [events, setEvents] = useState<PlatformEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlatformEventInput>(BLANK);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { events: list } = await fetchAdminEvents(token);
      setEvents(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setEditingId(null);
    setForm(BLANK);
  }

  function startEdit(event: PlatformEvent) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      eventType: event.eventType ?? "",
      mode: event.mode,
      location: event.location ?? "",
      address: event.address ?? "",
      startsAt: toLocalInput(event.startsAt),
      endsAt: toLocalInput(event.endsAt),
      bannerUrl: event.bannerUrl,
      iconUrl: event.iconUrl,
      registrationUrl: event.registrationUrl ?? "",
      contactPhone: event.contactPhone ?? "",
      isPublished: event.isPublished,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const startsAt = fromLocalInput(form.startsAt);
    if (!startsAt) {
      setError("Pick a valid start date and time");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload: PlatformEventInput = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        eventType: form.eventType?.trim() || null,
        // An online event has no venue, so we do not store one — otherwise a leftover "Vizag"
        // from before the mode was switched would show under an online workshop.
        location: form.mode === "ONLINE" ? null : form.location?.trim() || null,
        address: form.mode === "ONLINE" ? null : form.address?.trim() || null,
        registrationUrl: form.registrationUrl?.trim() || null,
        contactPhone: form.contactPhone?.trim() || null,
        startsAt,
        endsAt: fromLocalInput(form.endsAt ?? "") ?? "",
      };
      if (editingId) {
        await updateEvent(token, editingId, payload);
        showToast("Event updated", "success");
      } else {
        await createEvent(token, payload);
        showToast("Event published", "success");
      }
      setEditingId(null);
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(event: PlatformEvent) {
    if (!token) return;
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    try {
      await deleteEvent(token, event.id);
      if (editingId === event.id) startNew();
      showToast("Event deleted", "success");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    }
  }

  async function togglePublished(event: PlatformEvent) {
    if (!token) return;
    try {
      await updateEvent(token, event.id, { isPublished: !event.isPublished });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    }
  }

  const isOnline = form.mode === "ONLINE";

  return (
    <div>
      <h2>Events</h2>
      <p className="hint">
        Health camps, workshops and drives shown in the mobile app. Events move from &quot;Upcoming&quot; to
        &quot;Past&quot; on their own once the end time passes — there is nothing to switch by hand.
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="community-layout" style={{ marginTop: 16 }}>
        <div>
          {!events ? (
            <>
              <Skeleton width="100%" height={80} />
              <Skeleton width="100%" height={80} />
            </>
          ) : events.length === 0 ? (
            <EmptyState title="No events yet" subtitle="Announce the first one using the form." />
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={[
                  "community-row",
                  editingId === event.id ? "is-selected" : "",
                  event.isPublished ? "" : "is-hidden",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {event.iconUrl || event.bannerUrl ? (
                  <img src={event.iconUrl ?? event.bannerUrl ?? ""} alt="" className="community-thumb" />
                ) : (
                  <div className="community-thumb community-thumb-placeholder">◷</div>
                )}

                <div className="community-row-main">
                  <p className="community-row-title">{event.title}</p>
                  <p className="community-row-meta">
                    {whenLabel(event)} · {event.mode === "ONLINE" ? "Online" : event.location || "Venue TBA"}
                    {event.isPublished ? "" : " · unpublished"}
                  </p>
                </div>

                {isAdmin && (
                  <div className="row-actions">
                    <button type="button" className="chip" onClick={() => togglePublished(event)}>
                      {event.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" className="chip" onClick={() => startEdit(event)}>
                      Edit
                    </button>
                    <button type="button" className="btn-action-danger" onClick={() => handleDelete(event)}>
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
              <h3 style={{ marginTop: 0 }}>{editingId ? "Edit event" : "New event"}</h3>
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
                  placeholder="Free Health Checkup Camp"
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Type (optional)
                <input
                  type="text"
                  value={form.eventType ?? ""}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  placeholder="Health camp"
                  maxLength={40}
                />
              </label>

              <div className="mode-row">
                {(["OFFLINE", "ONLINE"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`mode-option ${form.mode === mode ? "active" : ""}`}
                    onClick={() => setForm({ ...form, mode })}
                  >
                    {mode === "OFFLINE" ? "In person" : "Online"}
                  </button>
                ))}
              </div>

              {!isOnline && (
                <>
                  <label>
                    City / venue name
                    <input
                      type="text"
                      value={form.location ?? ""}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Vizag"
                    />
                  </label>
                  <label>
                    Full address (shown on the event page)
                    <textarea
                      rows={2}
                      value={form.address ?? ""}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Community hall, MVP Colony, Visakhapatnam"
                    />
                  </label>
                </>
              )}

              <label>
                Starts
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  required
                />
              </label>

              <label>
                Ends (optional)
                <input
                  type="datetime-local"
                  value={form.endsAt ?? ""}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </label>

              <label>
                Description
                <textarea
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What happens, who it is for, what to bring."
                  required
                />
              </label>

              {token ? (
                <>
                  <ImageCropField
                    label="Banner"
                    hint="The wide image at the top of the event page."
                    shape="banner"
                    value={form.bannerUrl ?? null}
                    onChange={(url) => setForm({ ...form, bannerUrl: url })}
                    token={token}
                  />
                  <ImageCropField
                    label="Icon (optional)"
                    hint="The small square on the event row in the app's menu."
                    shape="square"
                    value={form.iconUrl ?? null}
                    onChange={(url) => setForm({ ...form, iconUrl: url })}
                    token={token}
                  />
                </>
              ) : null}

              <label>
                Registration link (optional)
                <input
                  type="url"
                  value={form.registrationUrl ?? ""}
                  onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })}
                  placeholder="https://…"
                />
              </label>

              <label>
                Contact number (optional)
                <input
                  type="tel"
                  value={form.contactPhone ?? ""}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+91…"
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
                {isSaving ? "Saving…" : editingId ? "Save changes" : "Publish event"}
              </button>
            </form>
          </Card>
        ) : (
          <Card>
            <p className="hint" style={{ margin: 0 }}>
              Staff accounts can review events. Creating and editing them is an admin action.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
