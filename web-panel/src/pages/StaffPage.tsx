import { TeamManager } from "../components/TeamManager";

/** An orphanage's public staff list — the same records an NGO publishes as its team. */
export function StaffPage() {
  return (
    <div>
      <h2>Staff</h2>
      <p className="hint">
        The people who run your home. They appear on your public page in the app, where donors see
        them before they sponsor a meal.
      </p>

      <TeamManager
        heading="Your staff"
        hint="These are listing entries, not platform accounts — staff don't need to sign up."
        noun="staff member"
      />
    </div>
  );
}
