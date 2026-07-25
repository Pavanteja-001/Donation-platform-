// EXPO_PUBLIC_API_URL is inlined at build time (Expo's built-in env support).
// Defaults to the backend's local dev port (see backend/README.md).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export type Role = "USER" | "INSTITUTION" | "ADMIN" | "STAFF";

export type BloodGroup =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  // PRD §8.1 — blood donor profile, opt-in, all nullable until filled in.
  bloodGroup: BloodGroup | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  lastDonationDate: string | null;
  availableToDonate: boolean;
  expoPushToken: string | null;
}

// PRD §8.2 — computed fresh server-side on every /api/auth/me read, never stored.
export interface BloodEligibility {
  hasProfile: boolean;
  eligible: boolean;
  reasons: string[];
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

// PRD §9.1 — only meaningful when type === "KIT". `upi_id` is only present when mode === "MONEY".
export interface KitPayload {
  contents: string;
  cost_per_kit: number;
  kits_needed: number;
  kits_funded: number;
  mode: "MONEY" | "DELIVER";
  upi_id?: string;
}

// PRD §8.3 — only meaningful when type === "BLOOD".
export interface BloodPayload {
  blood_group: BloodGroup;
  units_needed: number;
  units_fulfilled: number;
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
  photos: string[];
  linkedInstitutionId: string | null;
  institutionVerified: boolean;
  adminVerified: boolean;
  payload: MoneyPayload | KitPayload | BloodPayload | Record<string, unknown> | null;
  postedBy: { id: string; name: string | null; role: Role };
  createdAt: string;
}

export type ContributionKind = "MONEY" | "KIT" | "BLOOD";
export type ContributionStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";

export interface Contribution {
  id: string;
  needId: string;
  kind: ContributionKind;
  // BLOOD only — units pledged, usually 1 (§8.5). Null for MONEY/KIT.
  units: number | null;
  // MONEY: amount always set. KIT mode=MONEY: amount set, kits set. KIT mode=DELIVER: amount
  // null, kits set, utr null (§9.2 — no payment for a physical delivery pledge).
  amount: number | null;
  kits: number | null;
  status: ContributionStatus;
  utr: string | null;
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
  return request<{ token: string; user: AuthUser; bloodEligibility: BloodEligibility }>("/api/auth/otp/verify", {
    method: "POST",
    // role omitted — self-registration through the mobile app is always the USER
    // (donor/beneficiary) role; INSTITUTION accounts register from the web panel.
    body: JSON.stringify({ phone, code, name }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser; bloodEligibility: BloodEligibility }>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Self-service profile edits (PRD §8.1) — bloodGroup/dateOfBirth/gender/availableToDonate/
// expoPushToken, plus name/city/area. `lastDonationDate` is deliberately not accepted here —
// see the same note server-side (routes/auth.ts) on why that's not client-settable.
export function updateMe(
  token: string,
  data: Partial<{
    name: string;
    city: string;
    area: string;
    bloodGroup: BloodGroup;
    dateOfBirth: string;
    gender: Gender;
    availableToDonate: boolean;
    expoPushToken: string;
  }>
) {
  return request<{ user: AuthUser }>("/api/auth/me", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
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
  data: { title: string; description: string; targetAmount: number; upiId: string; photos?: string[] }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: "MONEY",
      title: data.title,
      description: data.description,
      photos: data.photos,
      payload: { target_amount: data.targetAmount, upi_id: data.upiId },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §9.1 — creates a DRAFT KIT need, then immediately submits it (mirrors postMoneyNeed).
export async function postKitNeed(
  token: string,
  data: {
    title: string;
    description: string;
    contents: string;
    costPerKit: number;
    kitsNeeded: number;
    mode: "MONEY" | "DELIVER";
    upiId?: string;
    photos?: string[];
  }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: "KIT",
      title: data.title,
      description: data.description,
      photos: data.photos,
      payload: {
        contents: data.contents,
        cost_per_kit: data.costPerKit,
        kits_needed: data.kitsNeeded,
        mode: data.mode,
        ...(data.mode === "MONEY" ? { upi_id: data.upiId } : {}),
      },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §8.3 — creates a DRAFT BLOOD need, then immediately submits it (mirrors postMoneyNeed).
// `linkedInstitutionId` lets the poster link a hospital/blood bank for fast-track verification
// (D-008) — the field exists and the backend fully supports it (curl-tested), but there's no
// institution picker in this milestone's mobile UI yet (no "list institutions" endpoint to pick
// from) — linking mostly matters when an INSTITUTION itself posts, which happens from web-panel.
export async function postBloodNeed(
  token: string,
  data: {
    title: string;
    description: string;
    bloodGroup: BloodGroup;
    unitsNeeded: number;
    linkedInstitutionId?: string;
    photos?: string[];
  }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: "BLOOD",
      title: data.title,
      description: data.description,
      photos: data.photos,
      linkedInstitutionId: data.linkedInstitutionId,
      payload: { blood_group: data.bloodGroup, units_needed: data.unitsNeeded },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Object storage (CLAUDE.md §6 / D-011): the backend only signs a short-lived upload URL — the
// client uploads the file bytes straight to the bucket, never through the backend.
export function signUpload(token: string, contentType: string, folder: "contribution-proofs" | "need-photos" | "need-qr") {
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

// Signs + uploads each photo in sequence and returns their public URLs, ready to pass as
// Need.photos. Sequential (not Promise.all) to keep it simple and avoid hammering the signing
// endpoint — photo counts are small (capped at 5) so this isn't a meaningful latency cost.
export async function uploadPhotos(
  token: string,
  photos: { uri: string; mimeType: string }[],
  folder: "need-photos"
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const signed = await signUpload(token, photo.mimeType, folder);
    await uploadToSignedUrl(signed.uploadUrl, photo.uri, photo.mimeType);
    urls.push(signed.publicUrl);
  }
  return urls;
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

// PRD §9.2 — kit donate step. `utr` is required for mode=MONEY, must be omitted for
// mode=DELIVER (a physical delivery pledge with no payment) — the backend enforces this too.
export function donateKit(token: string, needId: string, data: { kits: number; utr?: string; proofUrl?: string }) {
  return request<{ contribution: Contribution }>(`/api/needs/${needId}/contributions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// PRD §8.5.1 — "I can donate": a pledge, never a payment. Responding is itself the donor's
// consent to share their response with the beneficiary/institution — no separate consent step.
export function respondToBloodNeed(token: string, needId: string, units: number = 1) {
  return request<{ contribution: Contribution }>(`/api/needs/${needId}/contributions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ units }),
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
