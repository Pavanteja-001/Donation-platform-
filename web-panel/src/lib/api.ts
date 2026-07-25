const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Role = "USER" | "INSTITUTION" | "ADMIN" | "STAFF";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
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
    // role: INSTITUTION — this panel is for NGOs/hospitals/blood banks/orphanages (PRD §4).
    body: JSON.stringify({ phone, code, name, role: "INSTITUTION" }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser }>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
