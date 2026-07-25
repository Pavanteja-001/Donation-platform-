const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
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
    // role: INSTITUTION — this panel is for NGOs/hospitals/blood banks/orphanages (PRD §4).
    body: JSON.stringify({ phone, code, name, role: "INSTITUTION" }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser }>("/api/auth/me", { headers: authHeaders(token) });
}

// Every need this institution posted, any status — how they track verification progress.
export function fetchMyNeeds(token: string) {
  return request<{ needs: Need[] }>("/api/needs/mine", { headers: authHeaders(token) });
}

export function fetchNeed(token: string, id: string) {
  return request<{ need: Need }>(`/api/needs/${id}`, { headers: authHeaders(token) });
}

// PRD §7.1 — creates a DRAFT MONEY need, then immediately submits it (mirrors mobile's flow;
// the backend still supports a separate save-as-draft, just no UI for it here yet either).
export async function postMoneyNeed(
  token: string,
  data: { title: string; description: string; targetAmount: number; upiId: string }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "MONEY",
      title: data.title,
      description: data.description,
      payload: { target_amount: data.targetAmount, upi_id: data.upiId },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function fetchContributions(token: string, needId: string) {
  return request<{ contributions: Contribution[] }>(`/api/needs/${needId}/contributions`, {
    headers: authHeaders(token),
  });
}

// PRD §7.3 — the beneficiary (here: the institution that posted the need) confirms/rejects.
export function confirmContribution(token: string, contributionId: string) {
  return request<{ contribution: Contribution }>(`/api/contributions/${contributionId}/confirm`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function rejectContribution(token: string, contributionId: string) {
  return request<{ contribution: Contribution }>(`/api/contributions/${contributionId}/reject`, {
    method: "POST",
    headers: authHeaders(token),
  });
}
