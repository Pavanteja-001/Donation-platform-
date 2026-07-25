const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Role = "USER" | "INSTITUTION" | "ADMIN" | "STAFF";
export type InstitutionType = "NGO" | "HOSPITAL" | "BLOOD_BANK" | "ORPHANAGE";
export type KycStatus = "NOT_SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  email?: string | null;
  city?: string | null;
  area?: string | null;
  institutionType?: InstitutionType | null;
  legalName?: string | null;
  registrationNumber?: string | null;
  darpanId?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  kycDocumentUrl?: string | null;
  kycPhotos?: string[];
  kycStatus?: KycStatus;
  kycRejectionReason?: string | null;
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

// PRD §9.1 — only meaningful when type === "KIT". `upi_id` present only when mode === "MONEY".
export interface KitPayload {
  contents: string;
  cost_per_kit: number;
  kits_needed: number;
  kits_funded: number;
  mode: "MONEY" | "DELIVER";
  upi_id?: string;
}

export type BloodGroup =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";

// PRD §8.3 — only meaningful when type === "BLOOD".
export interface BloodPayload {
  blood_group: BloodGroup;
  units_needed: number;
  units_fulfilled: number;
}

// PRD §10.1 — only meaningful when type === "MEAL_SLOT". Per-date state lives in `mealSlots`
// on the Need (§10.2), not here.
export interface MealSlotPayload {
  meal_type: string;
  cost_per_slot: number;
  slots_total: number;
  slots_confirmed: number;
  mode: "MONEY" | "DELIVER";
  upi_id?: string;
}

export type MealSlotStatus = "OPEN" | "BOOKED" | "CONFIRMED";

// PRD §10.2 — one bookable calendar date under a MEAL_SLOT need.
export interface MealSlot {
  id: string;
  date: string;
  status: MealSlotStatus;
}

// PRD §11.2 — only meaningful when type === "GOODS". No progress bar — `claimed` is a boolean,
// there's no partial state (§11.3).
export interface GoodsPayload {
  item: string;
  condition: string;
  claimed: boolean;
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
  payload: MoneyPayload | KitPayload | BloodPayload | MealSlotPayload | GoodsPayload | Record<string, unknown> | null;
  // Only ever non-empty for MEAL_SLOT needs (§10.2).
  mealSlots: MealSlot[];
  postedBy: { id: string; name: string | null; role: Role };
  createdAt: string;
}

export type ContributionKind = "MONEY" | "KIT" | "BLOOD" | "MEAL_SLOT" | "GOODS";
export type ContributionStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";

export interface Contribution {
  id: string;
  kind: ContributionKind;
  amount: number | null;
  kits: number | null;
  units: number | null;
  // MEAL_SLOT only — the calendar date this contribution booked (§10.4).
  mealSlotDate: string | null;
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

export function updateMe(
  token: string,
  data: Partial<{
    name: string;
    email: string | null;
    city: string;
    area: string;
    institutionType: InstitutionType;
    legalName: string;
    registrationNumber: string;
    darpanId: string | null;
    address: string;
    bankAccount: string;
    kycDocumentUrl: string;
    kycPhotos: string[];
    kycStatus: KycStatus;
  }>
) {
  return request<{ user: AuthUser }>("/api/auth/me", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
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
  data: { title: string; description: string; targetAmount: number; upiId: string; photos?: string[] }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: authHeaders(token),
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
    headers: authHeaders(token),
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
    headers: authHeaders(token),
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
    headers: authHeaders(token),
  });
}

// PRD §8.3 — creates a DRAFT BLOOD need, then immediately submits it (mirrors postMoneyNeed).
// An institution posting its own request typically links itself (see `linkedInstitutionId`
// param) so it can fast-track-verify via institutionVerifyNeed below (D-008) rather than
// waiting on admin.
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
    headers: authHeaders(token),
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
    headers: authHeaders(token),
  });
}

// PRD §10.1/§10.2 — creates a DRAFT MEAL_SLOT need with one MealSlot row per date, then
// immediately submits it (mirrors postBloodNeed). `linkedInstitutionId` auto-links the posting
// institution, same fast-track-verify reasoning as blood.
export async function postMealSlotNeed(
  token: string,
  data: {
    title: string;
    description: string;
    mealType: string;
    costPerSlot: number;
    mode: "MONEY" | "DELIVER";
    upiId?: string;
    dates: string[];
    linkedInstitutionId?: string;
    photos?: string[];
  }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "MEAL_SLOT",
      title: data.title,
      description: data.description,
      photos: data.photos,
      linkedInstitutionId: data.linkedInstitutionId,
      payload: {
        meal_type: data.mealType,
        cost_per_slot: data.costPerSlot,
        mode: data.mode,
        dates: data.dates,
        ...(data.mode === "MONEY" ? { upi_id: data.upiId } : {}),
      },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// PRD §11.1 — creates a DRAFT GOODS need, then immediately submits it (mirrors postBloodNeed).
export async function postGoodsNeed(
  token: string,
  data: { title: string; description: string; item: string; condition: string; linkedInstitutionId?: string; photos?: string[] }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "GOODS",
      title: data.title,
      description: data.description,
      photos: data.photos,
      linkedInstitutionId: data.linkedInstitutionId,
      payload: { item: data.item, condition: data.condition },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// D-008 — the linked institution verifies a need independently of admin; either path alone is
// enough to reach LIVE ("fast-track"). 403s if the caller isn't that need's linkedInstitutionId.
export function institutionVerifyNeed(token: string, needId: string) {
  return request<{ need: Need }>(`/api/needs/${needId}/institution-verify`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// D-012 — urgency is admin/institution-verified, never self-declared; this is the only way to
// set it. Admin/Staff can set it on anything; an institution only on needs linked to it.
export function setNeedUrgency(token: string, needId: string, urgency: Urgency) {
  return request<{ need: Need }>(`/api/needs/${needId}/urgency`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ urgency }),
  });
}

// Object storage (CLAUDE.md §6 / D-021): the backend only signs a short-lived upload URL — the
// client uploads the file bytes straight to the bucket, never through the backend.
export function signUpload(token: string, contentType: string, folder: "contribution-proofs" | "need-photos" | "need-qr" | "kyc-docs") {
  return request<{ uploadUrl: string; publicUrl: string; key: string }>("/api/uploads/sign", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ contentType, folder }),
  });
}

export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}

// Signs + uploads each file in sequence and returns their public URLs, ready to pass as
// Need.photos.
export async function uploadPhotos(token: string, files: File[], folder: "need-photos"): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const signed = await signUpload(token, file.type, folder);
    await uploadToSignedUrl(signed.uploadUrl, file);
    urls.push(signed.publicUrl);
  }
  return urls;
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
