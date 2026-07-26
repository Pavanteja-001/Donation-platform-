import { Linking, Platform } from "react-native";
import type { Need } from "./api";

// PRD Idea — WhatsApp Integration ("Share this need").
// Formats a rich WhatsApp share text with urgency badges, category, location, and web link.
export function formatNeedShareText(need: Need): string {
  const urgencyEmoji =
    need.urgency === "EMERGENCY" ? "🚨 EMERGENCY" : need.urgency === "URGENT" ? "⚡ URGENT" : "ℹ️ NEED";

  const locationStr = [need.area, need.city].filter(Boolean).join(", ");
  const locationText = locationStr ? `📍 *Location:* ${locationStr}\n` : "";

  const typeLabel =
    need.type === "BLOOD"
      ? "🩸 Blood Donation"
      : need.type === "MONEY"
      ? "💰 Financial Help"
      : need.type === "KIT"
      ? "📦 Care Kit"
      : need.type === "MEAL_SLOT"
      ? "🍲 Meal Slot"
      : need.type === "GOODS"
      ? "🎁 Goods / Equipment"
      : need.type === "SKILL_REQUEST"
      ? "🤝 Volunteer Request"
      : "Help Request";

  return (
    `*${urgencyEmoji} — ${typeLabel}*\n\n` +
    `*${need.title}*\n\n` +
    `${need.description.slice(0, 180)}${need.description.length > 180 ? "…" : ""}\n\n` +
    locationText +
    `\nCan you help or share this with someone who can? Every bit counts!\n` +
    `👉 Open DonationPlatform app to help.`
  );
}

export async function shareNeedViaWhatsApp(need: Need): Promise<boolean> {
  const message = formatNeedShareText(need);
  const encodedText = encodeURIComponent(message);
  const whatsappUrl = `whatsapp://send?text=${encodedText}`;
  const webFallbackUrl = `https://wa.me/?text=${encodedText}`;

  try {
    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return true;
    } else {
      await Linking.openURL(webFallbackUrl);
      return true;
    }
  } catch (err) {
    if (Platform.OS === "web") {
      window.open(webFallbackUrl, "_blank");
      return true;
    }
    // Try opening web fallback if scheme failed
    try {
      await Linking.openURL(webFallbackUrl);
      return true;
    } catch {
      return false;
    }
  }
}
