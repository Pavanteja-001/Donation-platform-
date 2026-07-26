// D-009 — UPI deep-link & QR helper for web. Generates standard upi://pay intent URL
// and QR code image URL for scanning via mobile UPI apps (GPay, PhonePe, Paytm, BHIM).
export function buildUpiDeepLink(params: { upiId: string; payeeName: string; amount: number; note: string }): string {
  const query = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    am: String(params.amount),
    cu: "INR",
    tn: params.note,
  });
  return `upi://pay?${query.toString()}`;
}

export function buildUpiQrCodeUrl(params: { upiId: string; payeeName: string; amount?: number; note?: string }): string {
  const deepLink = buildUpiDeepLink({
    upiId: params.upiId,
    payeeName: params.payeeName,
    amount: params.amount ?? 0,
    note: params.note ?? "Donation",
  });
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deepLink)}`;
}
