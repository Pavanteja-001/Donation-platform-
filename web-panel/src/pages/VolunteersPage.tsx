import { useEffect, useState } from "react";
import {
  approveVolunteer,
  fetchVolunteerApplications,
  rejectVolunteer,
  type VolunteerApplication,
  type VolunteerStatus,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { TeamManager } from "../components/TeamManager";
import { EmptyState, ErrorState } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

/** Pending first — those are the only rows waiting on a decision. */
const STATUS_ORDER: VolunteerStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export function VolunteersPage() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<VolunteerApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The team list owns its own fetching inside TeamManager.
  function load() {
    if (!token) return;
    setError(null);
    fetchVolunteerApplications(token)
      .then(({ applications }) => setApplications(applications))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applications"));
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

      <TeamManager
        heading="Your team"
        hint="People donors will see on your page. These are listing entries, not platform accounts — team members don't need to sign up."
      />

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
