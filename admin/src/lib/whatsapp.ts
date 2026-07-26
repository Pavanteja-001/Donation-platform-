import type { Need } from "./api";

export function formatNeedShareText(need: Need): string {
  const urgencyEmoji =
    need.urgency === "EMERGENCY" ? "🚨 EMERGENCY" : need.urgency === "URGENT" ? "⚡ URGENT" : "ℹ️ NEED";

  const locationStr = [need.area, need.city].filter(Boolean).join(", ");
  const locationText = locationStr ? `📍 Location: ${locationStr}\n` : "";

  return (
    `*${urgencyEmoji} — Verified Request*\n\n` +
    `*${need.title}*\n\n` +
    `${need.description.slice(0, 180)}${need.description.length > 180 ? "…" : ""}\n\n` +
    locationText +
    `\nVerified on DonationPlatform.`
  );
}

export function shareNeedViaWhatsApp(need: Need) {
  const text = formatNeedShareText(need);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
