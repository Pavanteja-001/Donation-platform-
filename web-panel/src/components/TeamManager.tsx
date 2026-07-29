import { useEffect, useState, type FormEvent } from "react";
import { addTeamMember, deleteTeamMember, fetchTeam, uploadPhotos, type TeamMember } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ErrorState } from "./ui";

/**
 * Publish the people behind an institution.
 *
 * Shared by NGOs ("team") and orphanages ("staff") — `TeamMember` is keyed on a plain institution
 * id rather than on NGOs specifically, so both types write the same rows through the same routes
 * and only the wording differs. Volunteer applications stay on the NGO page; they're a separate
 * flow that orphanages have no use for.
 */
export function TeamManager({
  heading,
  hint,
  noun = "team member",
}: {
  heading: string;
  hint: string;
  /** Used in the button and the remove confirmation, e.g. "staff member". */
  noun?: string;
}) {
  const { token } = useAuth();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberPhoto, setMemberPhoto] = useState<File[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  function load() {
    if (!token) return;
    fetchTeam(token)
      .then(({ team }) => setTeam(team))
      .catch(() => setTeam([]));
  }

  useEffect(load, [token]);

  async function handleRemove(m: TeamMember) {
    if (!token) return;
    setBusyId(m.id);
    try {
      await deleteTeamMember(token, m.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action failed");
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!token || !memberName.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (memberPhoto.length > 0) {
        const [uploaded] = await uploadPhotos(token, memberPhoto.slice(0, 1), "profile-photos");
        photoUrl = uploaded;
      }
      await addTeamMember(token, {
        name: memberName.trim(),
        role: memberRole.trim() || undefined,
        photoUrl,
        // Appended to the end; ordering is by position then creation date.
        position: team?.length ?? 0,
      });
      setMemberName("");
      setMemberRole("");
      setMemberPhoto([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't add that ${noun}`);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <>
      <h3 style={{ marginTop: 24, fontSize: 15 }}>
        {heading} ({team?.length ?? 0})
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        {hint}
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      {team && team.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          {team.map((m) => (
            <div key={m.id} className="card" style={{ padding: 12, width: 180, position: "relative" }}>
              {m.photoUrl ? (
                <img
                  src={m.photoUrl}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 24, objectFit: "cover", marginBottom: 8 }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    marginBottom: 8,
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
              <strong style={{ display: "block", fontSize: 14 }}>{m.name}</strong>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{m.role ?? "Team member"}</span>
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() => handleRemove(m)}
                disabled={busyId === m.id}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  background: "var(--color-danger)",
                  color: "#fff",
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="card" style={{ padding: 16, marginBottom: 32 }}>
        <div className="detail-grid">
          <label>
            Name
            <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
          </label>
          <label>
            Role
            <input
              type="text"
              placeholder="Founder, Programme Lead…"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
            />
          </label>
          <label>
            Photo
            <input type="file" accept="image/*" onChange={(e) => setMemberPhoto(Array.from(e.target.files ?? []))} />
          </label>
        </div>
        <button type="submit" disabled={isAdding || !memberName.trim()} style={{ marginTop: 16 }}>
          {isAdding ? "Adding…" : `+ Add ${noun}`}
        </button>
      </form>
    </>
  );
}
