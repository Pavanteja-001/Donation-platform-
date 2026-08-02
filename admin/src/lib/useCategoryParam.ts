import { useSearchParams } from "react-router-dom";
import { CATEGORIES, type NeedCategory } from "./needCategory";

/**
 * Reads the cause chosen on the post-need page out of `?category=`.
 *
 * Validated against the known list rather than cast: the value comes from a URL anyone can edit,
 * and forwarding an arbitrary string to the API would turn a typo into a 400 the user can't
 * explain. An unrecognised value is treated as "not chosen", which the backend handles by
 * inferring the category when the type allows exactly one.
 */
export function useCategoryParam(): NeedCategory | undefined {
  const [params] = useSearchParams();
  const raw = params.get("category");
  return CATEGORIES.some((c) => c.id === raw) ? (raw as NeedCategory) : undefined;
}
