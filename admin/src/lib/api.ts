const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Role = "USER" | "INSTITUTION" | "ADMIN" | "STAFF";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
}

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  city: string | null;
  area: string | null;
  createdAt: string;
}

export interface StaffAccount {
  id: string;
  phone: string;
  name: string | null;
  createdAt: string;
  createdByAdminId: string | null;
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
  postedBy: { id: string; name: string | null; phone?: string; role: Role };
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

export function verifyOtp(phone: string, code: string) {
  // No `role` here — ADMIN/STAFF accounts are provisioned out-of-band (seed script /
  // POST /api/admin/staff), never self-registered from this login form.
  return request<{ token: string; user: AuthUser }>("/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser }>("/api/auth/me", { headers: authHeaders(token) });
}

export function fetchUsers(token: string) {
  return request<{ users: AdminUser[] }>("/api/admin/users", { headers: authHeaders(token) });
}

export function updateUser(token: string, id: string, data: { city?: string; area?: string; name?: string }) {
  return request<{ user: AdminUser }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export function fetchStaff(token: string) {
  return request<{ staff: StaffAccount[] }>("/api/admin/staff", { headers: authHeaders(token) });
}

export function createStaff(token: string, phone: string, name: string) {
  return request<{ staff: StaffAccount }>("/api/admin/staff", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ phone, name }),
  });
}

export function deleteStaff(token: string, id: string) {
  return fetch(`${API_URL}/api/admin/staff/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then((res) => {
    if (!res.ok && res.status !== 204) throw new Error(`Request failed (${res.status})`);
  });
}

export function fetchNeed(token: string, id: string) {
  return request<{ need: Need }>(`/api/needs/${id}`, { headers: authHeaders(token) });
}

// `status` omitted = the verification queue (PENDING_VERIFICATION only); "ALL" or a specific
// NeedStatus for general oversight (backend: src/routes/admin.ts).
export function fetchAdminNeeds(token: string, status?: NeedStatus | "ALL") {
  const query = status ? `?status=${status}` : "";
  return request<{ needs: Need[] }>(`/api/admin/needs${query}`, { headers: authHeaders(token) });
}

export function verifyNeed(token: string, id: string) {
  return request<{ need: Need }>(`/api/admin/needs/${id}/verify`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function rejectNeed(token: string, id: string, reason: string) {
  return request<{ need: Need }>(`/api/admin/needs/${id}/reject`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
}

export function fetchContributions(token: string, needId: string) {
  return request<{ contributions: Contribution[] }>(`/api/needs/${needId}/contributions`, {
    headers: authHeaders(token),
  });
}

// ADMIN-only override (D-002/D-018) — the backend also enforces this.
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
