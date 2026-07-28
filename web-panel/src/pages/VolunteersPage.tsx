import { useEffect, useState, type FormEvent } from "react";
import {
  addTeamMember,
  approveVolunteer,
  deleteTeamMember,
  fetchTeam,
  fetchVolunteerApplications,
  rejectVolunteer,
  uploadPhotos,
  type TeamMember,
  type VolunteerApplication,
  type VolunteerStatus,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

/** Pending first — those are the only rows waiting on a decision. */
const STATUS_ORDER: VolunteerStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export function VolunteersPage() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<VolunteerApplication[] | null>(null);
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberPhoto, setMemberPhoto] = useState<File[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  function load() {
    if (!token) return;
    setError(null);
    fetchVolunteerApplications(token)
      .then(({ applications }) => setApplications(applications))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applications"));
    fetchTeam(token)
      .then(({ team }) => setTeam(team))
      .catch(() => setTeam([]));
  }

  useEffect(load, [token]);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action failed");
    } finally {
      setBusyId(null);
      load();
    }
  }

  function handleReject(a: VolunteerApplication) {
    // A reason is mandatory server-side (mirrors D-017) — the applicant is always told why.
    const reason = window.prompt(`Why can't you take ${a.user.name ?? "this volunteer"} on? They will see this.`);
    if (!reason) return;
    run(a.id, () => rejectVolunteer(token!, a.id, reason));
  }

  async function handleAddMember(e: FormEvent) {
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
      setError(err instanceof Error ? err.message : "Couldn't add that team member");
    } finally {
      setIsAdding(false);
    }
  }

  const sorted = applications
    ? [...applications].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : null;

  const pendingCount = applications?.filter((a) => a.status === "PENDING").length ?? 0;
  const approvedCount = applications?.filter((a) => a.status === "APPROVED").length ?? 0;

  return (
    <div>
      <h2>Volunteers &amp; team</h2>
      <p className="hint">
        Your team appears on your public page in the app. Approving a volunteer makes them an
        official member of your organisation — it shows on their profile.
      </p>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* --- Team ---------------------------------------------------------------------- */}
      <h3 style={{ marginTop: 24, fontSize: 15 }}>Your team ({team?.length ?? 0})</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        People donors will see on your page. These are listing entries, not platform accounts —
        team members don't need to sign up.
      </p>

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
                onClick={() => run(m.id, () => deleteTeamMember(token!, m.id))}
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

      <form onSubmit={handleAddMember} className="card" style={{ padding: 16, marginBottom: 32 }}>
        <div className="detail-grid">
          <label>
            Name
            <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
          </label>
          <label>
            Role
            <input type="text" placeholder="Founder, Programme Lead…" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} />
          </label>
          <label>
            Photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setMemberPhoto(Array.from(e.target.files ?? []))}
            />
          </label>
        </div>
        <button type="submit" disabled={isAdding || !memberName.trim()} style={{ marginTop: 16 }}>
          {isAdding ? "Adding…" : "+ Add team member"}
        </button>
      </form>

      {/* --- Applications -------------------------------------------------------------- */}
      <h3 style={{ fontSize: 15 }}>
        Volunteer applications {approvedCount > 0 && <span className="hint">· {approvedCount} active volunteers</span>}
      </h3>

      {pendingCount > 0 && (
        <div className="callout callout-warning">
          <strong>{pendingCount} awaiting your decision</strong>
          <span style={{ fontSize: 13 }}>Applicants are notified as soon as you approve or decline.</span>
        </div>
      )}

      {!error && !sorted && <PageSkeleton />}
      {sorted && sorted.length === 0 && (
        <EmptyState
          title="No applications yet"
          subtitle="People who tap “I can volunteer” on your page in the app will appear here."
        />
      )}

      {sorted && sorted.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Can help with</th>
              <th>Availability</th>
              <th>Note</th>
              <th className="col-status">Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.user.name ?? "Volunteer"}</strong>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    <a href={`tel:${a.user.phone}`}>{a.user.phone}</a>
                    {[a.user.area, a.user.city].filter(Boolean).length > 0 && (
                      <> · {[a.user.area, a.user.city].filter(Boolean).join(", ")}</>
                    )}
                  </div>
                </td>
                <td>{a.skills ?? "—"}</td>
                <td>{a.availability ?? "—"}</td>
                <td style={{ maxWidth: 260 }}>{a.message ?? "—"}</td>
                <td>
                  <span className={`badge status-${a.status.toLowerCase()}`}>{a.status}</span>
                  {a.status === "REJECTED" && a.rejectionReason && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                      {a.rejectionReason}
                    </div>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    {a.status !== "APPROVED" && (
                      <button
                        type="button"
                        className="btn-action-success"
                        disabled={busyId === a.id}
                        onClick={() => run(a.id, () => approveVolunteer(token!, a.id))}
                      >
                        Approve
                      </button>
                    )}
                    {a.status === "PENDING" && (
                      <button type="button" className="btn-action-danger" disabled={busyId === a.id} onClick={() => handleReject(a)}>
                        Decline
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
