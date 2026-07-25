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

export interface Need {
  id: string;
  type: NeedType;
  title: string;
  description: string;
  status: string;
  urgency: Urgency;
  city: string | null;
  area: string | null;
  postedBy: { id: string; name: string | null; role: Role };
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
