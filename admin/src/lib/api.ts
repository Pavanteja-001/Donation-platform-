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
