import type { Feather } from "@expo/vector-icons";

/**
 * Built-in artwork for a helpline row.
 *
 * A helpline's icon comes from one of two places: `iconUrl` (an image an admin uploaded) or
 * `iconKey` (one of the names below). The key exists so a helpline is legible the moment it is
 * created — an admin adding "Women Helpline" at 2am should not have to find a PNG first, and a
 * row with no icon at all reads as broken on a screen people reach in an emergency.
 *
 * Keep these keys in sync with backend/prisma/seedCommunity.ts and the admin console's picker.
 */
export type HelplineIconKey =
  | "heart"
  | "ribbon"
  | "women"
  | "child"
  | "shield"
  | "ambulance"
  | "phone"
  | "fire"
  | "hospital";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

/**
 * Every entry is a Feather glyph. Feather has no ribbon/ambulance/hospital glyph, so those map to
 * the nearest honest stand-in rather than to something unrelated — an admin who wants exact
 * artwork uploads an `iconUrl`, which always wins over this table.
 */
export const HELPLINE_ICONS: Record<HelplineIconKey, FeatherName> = {
  heart: "heart",
  ribbon: "award",
  women: "user",
  child: "users",
  shield: "shield",
  ambulance: "truck",
  phone: "phone-call",
  fire: "alert-triangle",
  hospital: "plus-square",
};

/** Order shown in the admin console's icon picker. */
export const HELPLINE_ICON_KEYS = Object.keys(HELPLINE_ICONS) as HelplineIconKey[];

/** Falls back to a phone glyph — every row here is something you dial. */
export function helplineIcon(iconKey: string | null | undefined): FeatherName {
  if (iconKey && iconKey in HELPLINE_ICONS) return HELPLINE_ICONS[iconKey as HelplineIconKey];
  return "phone-call";
}
