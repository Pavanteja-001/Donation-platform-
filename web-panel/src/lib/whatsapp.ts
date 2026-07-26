import type { Need } from "./api";

export function formatNeedShareText(need: Need): string {
  const urgencyEmoji =
    need.urgency === "EMERGENCY" ? "🚨 EMERGENCY" : need.urgency === "URGENT" ? "⚡ URGENT" : "ℹ️ NEED";

  const locationStr = [need.area, need.city].filter(Boolean).join(", ");
  const locationText = locationStr ? `📍 Location: ${locationStr}\n` : "";

  return (
    `*${urgencyEmoji} — Help Request*\n\n` +
    `*${need.title}*\n\n` +
    `${need.description.slice(0, 180)}${need.description.length > 180 ? "…" : ""}\n\n` +
    locationText +
    `\nCan you help or share this with someone who can?\n` +
    `👉 Visit DonationPlatform to support.`
  );
}

export function shareNeedViaWhatsApp(need: Need) {
  const text = formatNeedShareText(need);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
