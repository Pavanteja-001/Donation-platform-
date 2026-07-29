import * as SecureStore from "expo-secure-store";

import type { Contribution, Need } from "./api";

/**
 * In-memory caches for the three list screens, so returning to a tab shows content instantly
 * instead of a skeleton while a fresh fetch runs in the background.
 *
 * These live here rather than as module state inside each screen to break a require cycle:
 * AuthContext needs to clear them on sign-out, and each screen needs AuthContext for its token —
 * so screen-owned caches meant AuthContext → screen → AuthContext. Metro tolerates that with the
 * "Require cycles are allowed" warning, but the resolution order is not guaranteed: whichever
 * module loads first can see the other's exports as `undefined`, which would make sign-out throw
 * on `clearNeedsFeedCache is not a function`.
 */
export interface ListCache<T> {
  data: T | null;
  fetchedAt: number;
}

function createListCache<T>(): ListCache<T> {
  return { data: null, fetchedAt: 0 };
}

export const needsFeedCache = createListCache<Need[]>();

const EMERGENCY_COUNT_KEY = "lastEmergencyCount";

/**
 * How many EMERGENCY needs the feed last showed.
 *
 * The rail can't shimmer from nothing — until the fetch lands, no code knows whether any cases
 * are open, and flashing a placeholder that resolves to an empty section is worse than showing
 * none. So the count is remembered instead of guessed.
 *
 * Persisted, not just in memory: an in-memory value is empty on every cold start, which is
 * exactly when the gap is most visible — the rail appeared late and shoved the whole feed down.
 * Read synchronously at module load so the very first paint already knows how many tiles to
 * shimmer. Only a first-ever launch has nothing to go on.
 *
 * `SecureStore` because it's the storage this app already ships; the value is a single integer
 * with no secrecy requirement, and a wrong or stale one costs nothing but a slightly wrong
 * placeholder count for one frame.
 */
function readPersistedCount(): number {
  try {
    const raw = SecureStore.getItem(EMERGENCY_COUNT_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    // Storage being unavailable must never stop the feed from rendering.
    return 0;
  }
}

export const emergencyCountMemo = { count: readPersistedCount() };

export function rememberEmergencyCount(count: number) {
  if (count === emergencyCountMemo.count) return;
  emergencyCountMemo.count = count;
  // Fire and forget — nothing in the UI waits on this.
  SecureStore.setItemAsync(EMERGENCY_COUNT_KEY, String(count)).catch(() => {});
}
export const myNeedsCache = createListCache<Need[]>();
export const contributionsCache = createListCache<Contribution[]>();

function reset<T>(cache: ListCache<T>) {
  cache.data = null;
  cache.fetchedAt = 0;
}

export function clearNeedsFeedCache() {
  reset(needsFeedCache);
  rememberEmergencyCount(0);
}

export function clearMyNeedsCache() {
  reset(myNeedsCache);
}

export function clearContributionsCache() {
  reset(contributionsCache);
}

/** Called on sign-out — one user's cached lists must never be visible to the next. */
export function clearAllListCaches() {
  clearNeedsFeedCache();
  clearMyNeedsCache();
  clearContributionsCache();
}

/**
 * Applies an updated Need to EVERY cached list that holds it.
 *
 * Patching one cache and not the others is silently wrong: updating a need's map pin from
 * My Needs used to refresh `myNeedsCache` only, so the feed kept the old coordinates — and
 * since the feed hands its copy to the detail screen as `initialNeed`, opening that need
 * straight afterwards showed the pre-update location. On a second device, with no local cache
 * at all, the same need looked correct. "Correct everywhere except the device that made the
 * change" is the signature of exactly this bug.
 *
 * `postedBy` is preserved from the cached copy because list endpoints include that relation
 * while a mutation response (e.g. PATCH /needs/:id/location) returns the bare Need.
 */
export function patchNeedInCaches(updated: Need): void {
  const apply = (list: Need[]) =>
    list.map((n) => (n.id === updated.id ? { ...n, ...updated, postedBy: n.postedBy } : n));

  if (needsFeedCache.data) needsFeedCache.data = apply(needsFeedCache.data);
  if (myNeedsCache.data) myNeedsCache.data = apply(myNeedsCache.data);
}

/** Shared staleness window for all three list screens. */
export const CACHE_TTL_MS = 15000;

export function isStale(cache: ListCache<unknown>): boolean {
  return Date.now() - cache.fetchedAt > CACHE_TTL_MS;
}
