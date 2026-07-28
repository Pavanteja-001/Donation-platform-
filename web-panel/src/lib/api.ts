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
  profilePhotoUrl?: string | null;
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

// PRD §13 — SKILL_REQUEST payload.
export interface SkillRequestPayload {
  role_needed: string;
  volunteers_needed: number;
  volunteers_joined: number;
  date: string;
  time: string;
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
  // The pinned (or server-resolved) coordinate the maps plot. Null when neither the poster
  // pinned one nor the need's area/district has a centre on record.
  latitude: number | null;
  longitude: number | null;
  deadline: string | null;
  rejectionReason: string | null;
  photos: string[];
  linkedInstitutionId: string | null;
  institutionVerified: boolean;
  adminVerified: boolean;
  payload: MoneyPayload | KitPayload | BloodPayload | MealSlotPayload | GoodsPayload | SkillRequestPayload | Record<string, unknown> | null;
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

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (err) {
    throw new ApiError("Unable to connect to the server. Please check your internet connection and try again.");
  }

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const status = res.status;
    if (body?.error) {
      throw new ApiError(body.error, status);
    }
    if (status === 401) {
      throw new ApiError("Session expired. Please log in again.", status);
    }
    if (status === 403) {
      throw new ApiError("Access denied: You do not have permission to perform this action.", status);
    }
    if (status === 409) {
      throw new ApiError("Conflict: This request has already been processed or a duplicate exists.", status);
    }
    throw new ApiError(`Request failed with status code ${status}. Please try again later.`, status);
  }
  return body as T;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function requestOtp(phone: string) {
  return request<{ ok: true; registered: boolean }>("/api/auth/otp/request", {
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
    profilePhotoUrl: string | null;
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
    city?: string;
    area?: string;
    latitude?: number;
    longitude?: number;
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
      city: data.city,
      area: data.area,
      latitude: data.latitude,
      longitude: data.longitude,
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
export function signUpload(token: string, contentType: string, folder: "contribution-proofs" | "need-photos" | "need-qr" | "kyc-docs" | "profile-photos") {
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

// Upload a single profile photo and return its public URL.
export async function uploadProfilePhoto(token: string, file: File): Promise<string> {
  const signed = await signUpload(token, file.type, "profile-photos");
  await uploadToSignedUrl(signed.uploadUrl, file);
  return signed.publicUrl;
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

// PRD §13 — SKILL_REQUEST: post a volunteering need (institution auto-linked for fast-track).
export async function postSkillRequestNeed(
  token: string,
  data: {
    title: string;
    description: string;
    role_needed: string;
    volunteers_needed: number;
    date: string;
    time: string;
    linkedInstitutionId?: string;
    city?: string;
    area?: string;
  }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "SKILL_REQUEST",
      title: data.title,
      description: data.description,
      city: data.city,
      area: data.area,
      linkedInstitutionId: data.linkedInstitutionId,
      payload: {
        role_needed: data.role_needed,
        volunteers_needed: data.volunteers_needed,
        date: data.date,
        time: data.time,
      },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// PRD §12 — Community Q&A Forum (D-023)
export interface ForumAuthor {
  id: string;
  name: string | null;
  profilePhotoUrl: string | null;
}

export interface ForumAnswer {
  id: string;
  body: string;
  author: ForumAuthor;
  createdAt: string;
}

export interface ForumQuestion {
  id: string;
  title: string;
  body: string;
  author: ForumAuthor;
  answers?: ForumAnswer[];
  _count?: { answers: number };
  createdAt: string;
}

export function fetchForumQuestions(token: string, cursor?: string) {
  const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<{ questions: ForumQuestion[]; nextCursor: string | null }>(`/api/forum${params}`, {
    headers: authHeaders(token),
  });
}

export function deleteForumQuestion(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/forum/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function deleteForumAnswer(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/forum/answers/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// `latitude`/`longitude` are the admin-managed district/locality centres — where a map picker
// should jump when this district/area is selected. Null = not set; leave the pin alone rather
// than guessing.
export interface AreaLocation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DistrictLocation {
  id: string;
  name: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  areas: AreaLocation[];
}

export function fetchLocations() {
  return request<{ districts: DistrictLocation[] }>("/api/locations");
}

// --- Notification inbox ---------------------------------------------------------------------
//
// Web users have no push token at all, so for an institution or a staff member this list IS the
// notification channel — not a history of something they already saw on a phone.
export type NotificationType =
  | "BLOOD_REQUEST"
  | "CONTRIBUTION_RECEIVED"
  | "CONTRIBUTION_CONFIRMED"
  | "NEED_STATUS"
  | "FORUM_ANSWER"
  | "VERIFICATION_QUEUE";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  needId: string | null;
  forumId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function fetchNotifications(token: string) {
  return request<{ notifications: AppNotification[]; nextCursor: string | null; unreadCount: number }>(
    "/api/notifications",
    { headers: authHeaders(token) }
  );
}

export function fetchUnreadCount(token: string) {
  return request<{ unreadCount: number }>("/api/notifications/unread-count", { headers: authHeaders(token) });
}

export function markNotificationRead(token: string, id: string) {
  return fetch(`${API_URL}/api/notifications/${id}/read`, { method: "POST", headers: authHeaders(token) }).then(
    () => undefined
  );
}

export function markAllNotificationsRead(token: string) {
  return request<{ updated: number }>("/api/notifications/read-all", { method: "POST", headers: authHeaders(token) });
}

export function deleteNotification(token: string, id: string) {
  return fetch(`${API_URL}/api/notifications/${id}`, { method: "DELETE", headers: authHeaders(token) }).then((res) => {
    if (!res.ok && res.status !== 204) throw new Error(`Request failed (${res.status})`);
  });
}

export function clearAllNotifications(token: string) {
  return request<{ deleted: number }>("/api/notifications", { method: "DELETE", headers: authHeaders(token) });
}
