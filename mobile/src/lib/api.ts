// EXPO_PUBLIC_API_URL is inlined at build time (Expo's built-in env support).
// Defaults to the backend's local dev port (see backend/README.md).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export type Role = "USER" | "INSTITUTION" | "ADMIN" | "STAFF";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
}

export type NeedType = "MONEY" | "BLOOD" | "KIT" | "GOODS" | "MEAL_SLOT" | "SKILL_REQUEST" | "QUESTION";
export type Urgency = "NORMAL" | "URGENT" | "EMERGENCY";
export type NeedStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "LIVE"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

// PRD §7.1 — only meaningful when type === "MONEY".
export interface MoneyPayload {
  target_amount: number;
  raised_amount: number;
  upi_id: string;
  upi_qr?: string;
}

export interface Need {
  id: string;
  type: NeedType;
  title: string;
  description: string;
  status: NeedStatus;
  urgency: Urgency;
  city: string | null;
  area: string | null;
  deadline: string | null;
  rejectionReason: string | null;
  payload: MoneyPayload | Record<string, unknown> | null;
  postedBy: { id: string; name: string | null; role: Role };
  createdAt: string;
}

export type ContributionStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";

export interface Contribution {
  id: string;
  needId: string;
  amount: number;
  status: ContributionStatus;
  utr: string;
  donor: { id: string; name: string | null; phone: string };
  createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function requestOtp(phone: string) {
  return request<{ ok: true }>("/api/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyOtp(phone: string, code: string, name?: string) {
  return request<{ token: string; user: AuthUser }>("/api/auth/otp/verify", {
    method: "POST",
    // role omitted — self-registration through the mobile app is always the USER
    // (donor/beneficiary) role; INSTITUTION accounts register from the web panel.
    body: JSON.stringify({ phone, code, name }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser }>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// The "browse live needs" feed (PRD §6.8) — server already ranks Emergency > Urgent > Normal,
// then recency.
export function fetchNeeds(token: string) {
  return request<{ needs: Need[] }>("/api/needs", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Every need this account posted, any status — how a poster tracks their own need's progress
// through verification without knowing its id ahead of time.
export function fetchMyNeeds(token: string) {
  return request<{ needs: Need[] }>("/api/needs/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchNeed(token: string, id: string) {
  return request<{ need: Need }>(`/api/needs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §7.1 — creates a DRAFT MONEY need, then immediately submits it (skips a separate
// "save as draft, edit later" UI for this milestone — the backend still supports it).
export async function postMoneyNeed(
  token: string,
  data: { title: string; description: string; targetAmount: number; upiId: string }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: "MONEY",
      title: data.title,
      description: data.description,
      payload: { target_amount: data.targetAmount, upi_id: data.upiId },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Object storage (CLAUDE.md §6 / D-011): the backend only signs a short-lived upload URL — the
// client uploads the file bytes straight to the bucket, never through the backend.
export function signUpload(token: string, contentType: string, folder: "contribution-proofs" | "need-qr") {
  return request<{ uploadUrl: string; publicUrl: string; key: string }>("/api/uploads/sign", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contentType, folder }),
  });
}

export async function uploadToSignedUrl(uploadUrl: string, localUri: string, contentType: string): Promise<void> {
  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();
  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }
}

// PRD §7.2 — donate step: pay via UPI happens outside the app (see lib/upi.ts), then the
// donor submits proof here.
export function donate(token: string, needId: string, data: { amount: number; utr: string; proofUrl?: string }) {
  return request<{ contribution: Contribution }>(`/api/needs/${needId}/contributions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function fetchContributions(token: string, needId: string) {
  return request<{ contributions: Contribution[] }>(`/api/needs/${needId}/contributions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §7.3 — beneficiary (or Admin override) confirms/rejects a pending contribution.
export function confirmContribution(token: string, contributionId: string) {
  return request<{ contribution: Contribution }>(`/api/contributions/${contributionId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function rejectContribution(token: string, contributionId: string) {
  return request<{ contribution: Contribution }>(`/api/contributions/${contributionId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
