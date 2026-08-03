import { Alert, Linking, Platform } from "react-native";
import type { PlatformEventCard } from "./api";

/**
 * Shared formatting + actions for the community panel (helplines, events, supporters), so the
 * drawer and the full-screen lists can never drift into showing the same value two ways.
 */

/**
 * Place a call.
 *
 * `tel:` is the only reliable dialler intent on both platforms; iOS uses `telprompt:` to keep the
 * user in the app after the call, but it is undocumented and rejected by some review passes, so
 * `tel:` it is. Non-digits are stripped because admin-entered numbers arrive with spaces, dashes
 * and the occasional "1800-XXX-XXXX" formatting.
 */
export async function dial(rawNumber: string): Promise<void> {
  const number = rawNumber.replace(/[^\d+]/g, "");
  if (!number) return;
  const url = `tel:${number}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error("unsupported");
    await Linking.openURL(url);
  } catch {
    // A tablet or emulator with no dialler must not fail silently — the number itself is the
    // useful thing, so show it in a form the user can read out or copy.
    Alert.alert("Can't place the call", `Dial ${rawNumber} from your phone app.`);
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "May 25, 2025" — the format on the reference design. */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "May 25, 2025 · 9:30 AM" — used on the detail page, where the time matters. */
export function formatEventDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${formatEventDate(iso)} · ${hour12}:${minutes} ${period}`;
}

/** The one line under an event title: "May 25, 2025 · Vizag" / "· Online". */
export function eventSubtitle(event: PlatformEventCard): string {
  const where = event.mode === "ONLINE" ? "Online" : event.location?.trim() || "Venue to be announced";
  return `${formatEventDate(event.startsAt)} · ${where}`;
}

/** Whole rupees with Indian digit grouping — ₹1,25,000, not ₹125,000. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** "B+" from "B_POSITIVE". */
export function formatBloodGroup(group: string | null | undefined): string | null {
  if (!group) return null;
  const [letters, sign] = group.split("_");
  if (!letters || !sign) return group;
  return `${letters}${sign === "POSITIVE" ? "+" : "-"}`;
}

/** Opens a registration link, quietly doing nothing rather than crashing on a malformed URL. */
export async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Can't open this link", Platform.OS === "web" ? url : "The link appears to be invalid.");
  }
}
