import { purgeExpiredNotifications } from "./notificationRetention";

/**
 * The platform's only background job runner.
 *
 * There is no cron service — Railway runs one web process and nothing else, and adding a second
 * always-on service to run a job that takes seconds a day would cost more than it saves. So the
 * schedule lives in-process, next to the server it maintains.
 *
 * Two properties everything registered here must have, because of that choice:
 *
 *   1. IDEMPOTENT — running twice must be harmless. There is no distributed lock, so if this ever
 *      runs on two replicas both will fire. Deletes satisfy this naturally: the second run finds
 *      nothing left. Anything added later that ISN'T safe to double-run needs a Postgres advisory
 *      lock first.
 *   2. INCREMENTAL — bounded work per run, with the remainder picked up next time. A job that must
 *      run to completion will eventually meet a table too big to finish, and then it fails forever.
 */

/** Every 6 hours. Retention is measured in months; there is nothing to gain from running it often. */
const INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Delay before the first run. Boot is the busiest, most memory-constrained moment in the process's
 * life — competing with route loading and the first requests to run a batch delete is a self-
 * inflicted cold-start stall.
 */
const STARTUP_DELAY_MS = 60_000;

/** Guards against a slow run overlapping the next tick. */
let running = false;

async function runMaintenance(): Promise<void> {
  if (running) {
    // eslint-disable-next-line no-console
    console.warn("[maintenance] previous run still in progress — skipping this tick");
    return;
  }
  running = true;
  const startedAt = Date.now();

  try {
    const { read, unread } = await purgeExpiredNotifications();
    if (read > 0 || unread > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[maintenance] purged notifications: ${read} read, ${unread} unread (${Date.now() - startedAt}ms)`
      );
    }
  } catch (err) {
    // Never rethrow. An unhandled rejection in a timer callback takes down the whole process, and
    // a failed cleanup pass is not worth dropping every in-flight donation request for — the next
    // tick will simply try again.
    // eslint-disable-next-line no-console
    console.error("[maintenance] run failed:", err);
  } finally {
    running = false;
  }
}

/**
 * Starts the schedule. Call once, after the HTTP server is listening.
 *
 * Set `DISABLE_MAINTENANCE_JOBS=true` to opt out — needed for tests, and for the day this moves to
 * a real scheduler and the web process should stop doing it.
 */
export function startMaintenanceJobs(): void {
  if (process.env.DISABLE_MAINTENANCE_JOBS === "true") {
    // eslint-disable-next-line no-console
    console.log("[maintenance] disabled via DISABLE_MAINTENANCE_JOBS");
    return;
  }

  // `unref()` on both timers: they must never be the reason the process stays alive. The HTTP
  // server owns the process lifetime — a pending 6-hour timer holding it open would turn every
  // deploy into a hung shutdown and then a forced kill.
  const first = setTimeout(() => {
    void runMaintenance();
    const repeating = setInterval(() => void runMaintenance(), INTERVAL_MS);
    repeating.unref();
  }, STARTUP_DELAY_MS);
  first.unref();

  // eslint-disable-next-line no-console
  console.log(
    `[maintenance] scheduled every ${INTERVAL_MS / 3_600_000}h, first run in ${STARTUP_DELAY_MS / 1000}s`
  );
}
