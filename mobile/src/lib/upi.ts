// D-009 — UPI deep-link, amount pre-filled. Built client-side; no backend involvement (D-001:
// no gateway, the donor pays the beneficiary's UPI ID directly).
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
