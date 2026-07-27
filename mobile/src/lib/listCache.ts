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
export const myNeedsCache = createListCache<Need[]>();
export const contributionsCache = createListCache<Contribution[]>();

function reset<T>(cache: ListCache<T>) {
  cache.data = null;
  cache.fetchedAt = 0;
}

export function clearNeedsFeedCache() {
  reset(needsFeedCache);
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

/** Shared staleness window for all three list screens. */
export const CACHE_TTL_MS = 15000;

export function isStale(cache: ListCache<unknown>): boolean {
  return Date.now() - cache.fetchedAt > CACHE_TTL_MS;
}
