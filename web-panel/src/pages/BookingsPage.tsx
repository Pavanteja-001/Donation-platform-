import { useEffect, useState } from "react";
import {
  acceptBooking,
  confirmBooking,
  fetchBookings,
  rejectBooking,
  type BookingStatus,
  type SlotBooking,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState } from "../components/ui";
import { PageSkeleton } from "../components/SkeletonLoader";

const MEAL_LABEL: Record<SlotBooking["mealType"], string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

/** Pending first — those are the only ones waiting on the home to do something. */
const STATUS_ORDER: BookingStatus[] = ["PENDING", "ACCEPTED", "CONFIRMED", "REJECTED", "CANCELLED"];

export function BookingsPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<SlotBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setError(null);
    fetchBookings(token)
      .then(({ bookings }) => setBookings(bookings))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bookings"));
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

  function handleReject(b: SlotBooking) {
    // A reason is mandatory server-side (mirroring D-017) — the donor is always told why.
    const reason = window.prompt(`Why can't you host this ${MEAL_LABEL[b.mealType].toLowerCase()}? The donor will see this.`);
    if (!reason) return;
    run(b.id, () => rejectBooking(token!, b.id, reason));
  }

  const sorted = bookings
    ? [...bookings].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    : null;

  const pendingCount = bookings?.filter((b) => b.status === "PENDING").length ?? 0;

  return (
    <div>
      <h2>Meal sponsorships</h2>
      <p className="hint">
        Donors book a date and meal from the app. Accepting reserves that slot; rejecting frees the
        date immediately so someone else can sponsor it.
      </p>

      {pendingCount > 0 && (
        <div className="callout callout-warning">
          <strong>{pendingCount} awaiting your response</strong>
          <span style={{ fontSize: 13 }}>Donors are told as soon as you accept or decline.</span>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !sorted && <PageSkeleton />}
      {sorted && sorted.length === 0 && (
        <EmptyState
          title="No sponsorships yet"
          subtitle="Set your meal prices on the Home profile page so donors can book a date."
        />
      )}

      {sorted && sorted.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="col-type">Meal</th>
              <th>Donor</th>
              <th>Occasion</th>
              <th className="col-progress">Amount</th>
              <th className="col-status">Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600 }}>{new Date(b.date).toDateString()}</td>
                <td>{MEAL_LABEL[b.mealType]}</td>
                <td>
                  {b.donor.name ?? "Donor"}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    <a href={`tel:${b.donor.phone}`}>{b.donor.phone}</a>
                  </div>
                </td>
                <td>
                  {b.purpose ?? "—"}
                  {b.peopleCount != null && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{b.peopleCount} people</div>
                  )}
                </td>
                <td className="cell-progress" style={{ fontWeight: 500 }}>
                  ₹{b.amount.toLocaleString("en-IN")}
                </td>
                <td>
                  <span className={`badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                  {b.status === "REJECTED" && b.rejectionReason && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                      {b.rejectionReason}
                    </div>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    {b.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="btn-action-success"
                          disabled={busyId === b.id}
                          onClick={() => run(b.id, () => acceptBooking(token!, b.id))}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn-action-danger"
                          disabled={busyId === b.id}
                          onClick={() => handleReject(b)}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {b.status === "ACCEPTED" && (
                      <button
                        type="button"
                        className="btn-action-primary"
                        disabled={busyId === b.id}
                        onClick={() => run(b.id, () => confirmBooking(token!, b.id))}
                        title="Mark the meal as delivered and payment received"
                      >
                        Confirm completed
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
