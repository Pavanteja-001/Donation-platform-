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

/**
 * How many EMERGENCY needs the feed last showed.
 *
 * The emergency rail can't shimmer from a cold start — nothing knows whether there are any cases
 * until the fetch lands, and a placeholder that resolves to an empty section is worse than no
 * placeholder. Remembering the last count means a refresh shimmers the right number of tiles and
 * a first-ever load shows nothing, which is the honest answer in both cases.
 */
export const emergencyCountMemo = { count: 0 };
export const myNeedsCache = createListCache<Need[]>();
export const contributionsCache = createListCache<Contribution[]>();

function reset<T>(cache: ListCache<T>) {
  cache.data = null;
  cache.fetchedAt = 0;
}

export function clearNeedsFeedCache() {
  reset(needsFeedCache);
  emergencyCountMemo.count = 0;
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
