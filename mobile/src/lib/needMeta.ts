import { Feather } from "@expo/vector-icons";
import type {
  BloodPayload,
  GoodsPayload,
  KitPayload,
  MealSlotPayload,
  MoneyPayload,
  Need,
  NeedStatus,
  NeedType,
} from "./api";
import { theme } from "./theme";
import type { BadgeTone } from "../components/ui";

export type IconName = keyof typeof Feather.glyphMap;

/**
 * Shared need presentation metadata.
 *
 * The feed card, the detail screen and the poster's own list all need the same icon/colour/label
 * for a given type and the same tone for a given status. Three copies of these tables meant a
 * BLOOD need could plausibly render one colour in one place and another elsewhere; this is the
 * source they all read from.
 */
export const TYPE_META: Record<NeedType, { label: string; icon: IconName; tint: string; color: string }> = {
  MONEY: { label: "Money", icon: "heart", tint: theme.color.primarySoft, color: theme.color.primary },
  BLOOD: { label: "Blood", icon: "droplet", tint: theme.color.bloodSoft, color: theme.color.blood },
  KIT: { label: "Kit", icon: "package", tint: theme.color.primarySoft, color: theme.color.primary },
  GOODS: { label: "Goods", icon: "box", tint: theme.color.infoSoft, color: theme.color.info },
  MEAL_SLOT: { label: "Meals", icon: "coffee", tint: theme.color.accentSoft, color: "#8A5A00" },
  SKILL_REQUEST: { label: "Skills", icon: "tool", tint: theme.color.infoSoft, color: theme.color.info },
  QUESTION: { label: "Question", icon: "help-circle", tint: theme.color.surfaceMuted, color: theme.color.textSecondary },
};

export const STATUS_BADGE_TONE: Record<NeedStatus, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_VERIFICATION: "accent",
  LIVE: "success",
  PARTIALLY_FULFILLED: "primary",
  FULFILLED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

/** Human-facing status wording. `PARTIALLY_FULFILLED` in particular reads badly raw. */
export const STATUS_LABEL: Record<NeedStatus, string> = {
  DRAFT: "Draft",
  PENDING_VERIFICATION: "In review",
  LIVE: "Live",
  PARTIALLY_FULFILLED: "Partly funded",
  FULFILLED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

// --- Payload narrowing -------------------------------------------------------
// `Need["payload"]` is a union across every need type, so each screen has to narrow before it can
// read type-specific fields.

export function isMoneyPayload(payload: Need["payload"]): payload is MoneyPayload {
  return !!payload && typeof (payload as MoneyPayload).target_amount === "number";
}

export function isKitPayload(payload: Need["payload"]): payload is KitPayload {
  return !!payload && typeof (payload as KitPayload).kits_needed === "number";
}

export function isBloodPayload(payload: Need["payload"]): payload is BloodPayload {
  return !!payload && typeof (payload as BloodPayload).units_needed === "number";
}

export function isMealSlotPayload(payload: Need["payload"]): payload is MealSlotPayload {
  return !!payload && typeof (payload as MealSlotPayload).slots_total === "number";
}

export function isGoodsPayload(payload: Need["payload"]): payload is GoodsPayload {
  return !!payload && typeof (payload as GoodsPayload).item === "string";
}

// --- Formatting --------------------------------------------------------------

/**
 * Coerces a possibly-missing numeric payload field to a usable number.
 *
 * `Need.payload` is untyped JSON at the database layer, so a row written before a progress field
 * existed — or seeded/edited directly — can be missing it entirely. The type guards above only
 * validate the *defining* field of each payload (e.g. `target_amount`), so such a payload still
 * narrows successfully and then blows up on read. Every numeric payload read goes through here.
 *
 * Zero is the right default: a missing progress field means nothing has been raised yet.
 */
export function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatBloodGroup(g: string) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

export function formatAmount(n: number | null | undefined) {
  return `₹${num(n).toLocaleString("en-IN")}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Compact relative age ("2h ago", "3d ago"). Lists need recency, not a full timestamp. */
export function timeAgo(iso: string): string | null {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
