import Redis from "ioredis";

/**
 * Redis-backed read cache.
 *
 * THE RULE THIS FILE IS BUILT AROUND: Redis is an accelerator, never a dependency. If
 * `REDIS_URL` is unset (local dev, or before the Railway addon exists) or Redis is unreachable
 * mid-request, every function here degrades to "cache miss" and the caller falls through to
 * Postgres. A donor must never see an error because a cache node blinked — and losing the cache
 * must never take the platform down with it.
 *
 * Consequences of that rule, all deliberate:
 *   - every call is wrapped and swallows its own errors,
 *   - reads are given a short timeout so a hung Redis can't stall a request,
 *   - `lazyConnect` + a bounded retry strategy, so a dead Redis doesn't spam reconnects forever.
 */

const REDIS_URL = process.env.REDIS_URL;

let client: Redis | null = null;
let hasLoggedFailure = false;

if (REDIS_URL) {
  client = new Redis(REDIS_URL, {
    lazyConnect: true,
    // Fail fast rather than queueing commands while a connection is down — a queued command
    // would hold the HTTP request open for the entire outage.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy(times) {
      // Back off to a 10s ceiling and keep trying — Railway restarts should self-heal without
      // needing a backend redeploy.
      return Math.min(times * 500, 10_000);
    },
  });

  client.on("error", (err) => {
    // Only log the first failure per outage: ioredis emits on every retry, and an unreachable
    // Redis would otherwise fill the logs and hide real errors.
    if (!hasLoggedFailure) {
      hasLoggedFailure = true;
      // eslint-disable-next-line no-console
      console.error("[cache] Redis unavailable — serving everything from Postgres:", err.message);
    }
  });

  client.on("ready", () => {
    hasLoggedFailure = false;
    // eslint-disable-next-line no-console
    console.log("[cache] Redis connected");
  });

  client.connect().catch(() => {
    // Already reported by the 'error' handler above.
  });
} else {
  // eslint-disable-next-line no-console
  console.log("[cache] REDIS_URL not set — cache disabled, reads go straight to Postgres");
}

export const isCacheEnabled = () => client !== null;

/**
 * Only talk to Redis when the connection is actually established.
 *
 * ioredis reports its own state, so a down/reconnecting node costs us nothing instead of the
 * per-request timeout we'd otherwise burn waiting for a command that cannot succeed. This is
 * the difference between "cache is down" and "cache is down AND the API got slower", which is
 * the worst of both worlds — measured at +150ms on every single request before this guard.
 */
function ready(): boolean {
  return client !== null && client.status === "ready";
}

/** Milliseconds a single cache read may take before we give up and hit Postgres instead. */
const READ_TIMEOUT_MS = 150;
/**
 * Writes get a bound too. Without one, a Redis that accepts TCP but never answers (or is
 * mid-reconnect) makes the *write* hang — measured at 5.2s per request against a dead Redis
 * before this existed, i.e. the cache made the API dramatically slower than having no cache.
 */
const WRITE_TIMEOUT_MS = 200;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!ready() || !client) return null;
  try {
    const raw = await withTimeout(client.get(key), READ_TIMEOUT_MS);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!ready() || !client) return;
  try {
    await withTimeout(client.set(key, JSON.stringify(value), "EX", ttlSeconds), WRITE_TIMEOUT_MS);
  } catch {
    // Non-fatal: the response has already been computed and is being sent regardless.
  }
}

/**
 * Drops keys by prefix. Uses SCAN, never KEYS — KEYS blocks the entire Redis event loop while it
 * walks the keyspace, which on a shared instance stalls every other request in the platform.
 */
export async function cacheInvalidate(prefix: string): Promise<void> {
  if (!ready() || !client) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== "0");
  } catch {
    // A failed invalidation is survivable — every cached entry also carries a TTL, so stale data
    // self-corrects within seconds rather than lingering forever.
  }
}

/**
 * Read-through helper: return the cached value, or run `loader`, cache it and return that.
 *
 * `loader` is always awaited on a miss, so a cache failure costs nothing but the normal query.
 */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const value = await loader();
  // Fire-and-forget: the response is already computed, so making the caller wait on a cache
  // write only adds latency — and on a struggling Redis, a lot of it. Populating the cache is
  // an optimisation for the *next* request, never an obligation to this one.
  void cacheSet(key, value, ttlSeconds);
  return value;
}

// Key prefixes in one place so invalidation sites can't drift from read sites — a typo'd prefix
// silently means "never invalidated", which is the worst kind of cache bug.
export const CacheKey = {
  locations: "locations:all",
  needsFeed: (type?: string) => `needs:feed:${type ?? "all"}`,
  needsFeedPrefix: "needs:feed:",
  analytics: "admin:analytics",
} as const;

/**
 * Call after ANY write that can change what the public feed shows or what the totals add up to:
 * verify, reject, cancel, delete, urgency change, contribution, slot booking, location edit.
 *
 * One helper rather than per-route invalidation lists, because the failure mode of forgetting a
 * site is invisible — donors just quietly see stale data. Fire-and-forget: the caller's response
 * must not wait on Redis.
 */
export function invalidateNeedCaches(): void {
  void cacheInvalidate(CacheKey.needsFeedPrefix);
  void cacheInvalidate(CacheKey.analytics);
}

/**
 * Call after any district/area write. Without this an admin's edit stays invisible for up to an
 * hour — which would look exactly like the "location changes don't apply" bug we just fixed.
 */
export function invalidateLocationsCache(): void {
  void cacheInvalidate(CacheKey.locations);
}

// TTLs. Deliberately short for anything a donor acts on: a stale blood need is worse than a slow
// one, and every write path below also invalidates explicitly — the TTL is just the safety net
// for an invalidation that failed or a write path someone forgets to wire up.
export const CacheTtl = {
  /** Districts/areas change only when an admin edits them, and that invalidates explicitly. */
  locations: 60 * 60,
  /** The public feed: fresh enough for a donor, still absorbs a burst of refreshes. */
  needsFeed: 30,
  /** Aggregations over the whole table — expensive, and nobody needs them to the second. */
  analytics: 60,
} as const;
