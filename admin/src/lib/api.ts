const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Role = "USER" | "INSTITUTION" | "ADMIN" | "STAFF";
export type InstitutionType = "NGO" | "HOSPITAL" | "BLOOD_BANK" | "ORPHANAGE";
export type KycStatus = "NOT_SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  kycStatus?: KycStatus;
}

export type TrustTier = "BRONZE" | "SILVER" | "GOLD";

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  city: string | null;
  area: string | null;
  createdAt: string;
  trustTier: TrustTier;
  confirmedContributionsCount: number;

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
export type GoodsDirection = "REQUEST" | "OFFER";

export interface GoodsPayload {
  item: string;
  condition: string;
  // Optional on read: needs written before offers existed carry neither key, and the server reads
  // them as single-quantity requests rather than rewriting old rows.
  direction?: GoodsDirection;
  quantity?: number;
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
  // Contact + location are ADMIN/STAFF-only: the API selects those columns solely for a
  // verifier, so they are optional here rather than assumed present (a donor-facing response
  // genuinely has none of them).
  postedBy: {
    id: string;
    name: string | null;
    role: Role;
    phone?: string;
    email?: string | null;
    city?: string | null;
    area?: string | null;
    createdAt?: string;
  };
  createdAt: string;
}

export type ContributionKind = "MONEY" | "KIT" | "BLOOD" | "MEAL_SLOT" | "GOODS";
export type ContributionStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";

export interface Contribution {
  id: string;
  kind: ContributionKind;
  // MONEY: amount always set. KIT/MEAL_SLOT mode=MONEY: amount+kits set. KIT/MEAL_SLOT
  // mode=DELIVER: amount/utr null, kits set — no payment for a physical delivery / in-person
  // pledge (PRD §9.2/§10.4). BLOOD: units set, amount/kits/utr null.
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

// ADMIN can post a need too (D-018 — Staff can verify/accept + list users, but posting on
// behalf of a partner org without a web-panel account of their own is Admin-only here, kept
// consistent with the rest of D-018's admin-vs-staff split rather than opening a new capability
// to Staff). Backend has no role restriction on POST /api/needs; this UI is what's scoped.
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

// PRD §8.3 — Admin posting a blood need on behalf of a beneficiary/partner org without their
// own account (D-018, mirrors postMoneyNeed/postKitNeed). No linkedInstitutionId — that's only
// for an institution's own self-verify fast-track (D-008), which doesn't apply to admin posts.
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
      payload: { blood_group: data.bloodGroup, units_needed: data.unitsNeeded },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// PRD §10.1/§10.2 — Admin posting a meal-slot need on behalf of a beneficiary/partner org
// (D-018, mirrors postBloodNeed). No linkedInstitutionId, same reasoning as postBloodNeed.
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

// PRD §11.1/§11.2 — Admin posting a goods need on behalf of a beneficiary/partner org (D-018,
// mirrors postBloodNeed/postMealSlotNeed).
export async function postGoodsNeed(
  token: string,
  data: { title: string; description: string; item: string; condition: string; photos?: string[] }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: "GOODS",
      title: data.title,
      description: data.description,
      photos: data.photos,
      payload: { item: data.item, condition: data.condition },
    }),
  });
  return request<{ need: Need }>(`/api/needs/${need.id}/submit`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// D-012 — urgency is admin/institution-verified, never self-declared; this is the only way to
// set it. Admin/Staff can set it on any need.
export function setNeedUrgency(token: string, needId: string, urgency: Urgency) {
  return request<{ need: Need }>(`/api/needs/${needId}/urgency`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ urgency }),
  });
}

// Object storage (CLAUDE.md §6 / D-021) — same pattern as web-panel/mobile.
export function signUpload(token: string, contentType: string, folder: "contribution-proofs" | "need-photos" | "need-qr") {
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

export async function uploadPhotos(token: string, files: File[], folder: "need-photos"): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const signed = await signUpload(token, file.type, folder);
    await uploadToSignedUrl(signed.uploadUrl, file);
    urls.push(signed.publicUrl);
  }
  return urls;
}

export function fetchKycQueue(token: string, status?: KycStatus | "ALL") {
  const query = status ? `?status=${status}` : "";
  return request<{ queue: AdminUser[] }>(`/api/admin/kyc/queue${query}`, { headers: authHeaders(token) });
}

export function updateKycStatus(token: string, userId: string, status: KycStatus, reason?: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${userId}/kyc`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ status, reason }),
  });
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

// Takes a live need off the feed and the map while keeping the row, its contributions and its
// history intact (CANCELLED is terminal, so it can't come back). Admin + Staff.
export function cancelNeed(token: string, id: string) {
  return request<{ need: Need }>(`/api/admin/needs/${id}/cancel`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// Irreversible, ADMIN only, and refused by the server the moment the need has a contribution —
// this is for junk (test posts, spam), not for winding down a real request.
export function deleteNeed(token: string, id: string) {
  return fetch(`${API_URL}/api/admin/needs/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then(async (res) => {
    if (res.status === 204) return;
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
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

// PRD §13 — SKILL_REQUEST: admin posts a volunteering need on behalf of a partner/beneficiary.
// Admin does NOT auto-link a linkedInstitutionId (same established rule as admin Blood/Goods pages
// — a self-verify fast-track only makes sense when the poster IS the institution).
export async function postSkillRequestNeed(
  token: string,
  data: {
    title: string;
    description: string;
    role_needed: string;
    volunteers_needed: number;
    date: string;
    time: string;
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

// PRD §12 — Community Q&A Forum moderation (D-023)
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

// PRD §21 / Admin Console §15 — Platform Analytics & Metrics
export interface AnalyticsData {
  totalUsers: number;
  totalInstitutions: number;
  totalNeeds: number;
  totalLiveNeeds: number;
  totalFulfilledNeeds: number;
  totalConfirmedContributions: number;
  totalMoneyRaised: number;
  totalKitsFunded: number;
  totalBloodUnitsFulfilled: number;
  totalMealSlotsConfirmed: number;
  totalVolunteersPledged: number;
}

export function fetchAnalytics(token: string) {
  return request<{ analytics: AnalyticsData }>("/api/admin/analytics", {
    headers: authHeaders(token),
  });
}

// A district/locality centre: where a map picker jumps when this row is selected, and the
// fallback the server stamps on a need posted without an exact pin. Null = not set yet.
export interface AreaLocation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DistrictItem {
  id: string;
  name: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  areas: AreaLocation[];
}

export type Coordinates = { latitude: number; longitude: number };

export function fetchLocations() {
  return request<{ districts: DistrictItem[] }>("/api/locations");
}

export function createDistrict(token: string, name: string, state?: string, coords?: Coordinates) {
  return request<{ district: DistrictItem }>("/api/admin/locations/districts", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, state, ...coords }),
  });
}

// Refines an existing centre. The seeded coordinates are approximate locality centres — this
// is how an admin corrects one without touching the seed.
export function updateDistrict(token: string, id: string, data: Partial<Coordinates> & { name?: string; state?: string }) {
  return request<{ district: DistrictItem }>(`/api/admin/locations/districts/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export function updateArea(token: string, id: string, data: Partial<Coordinates> & { name?: string }) {
  return request<{ area: AreaLocation }>(`/api/admin/locations/areas/${id}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export function deleteDistrict(token: string, id: string) {
  return fetch(`${API_URL}/api/admin/locations/districts/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then((res) => {
    if (!res.ok && res.status !== 204) throw new Error(`Request failed (${res.status})`);
  });
}

export function createArea(token: string, districtId: string, name: string, coords?: Coordinates) {
  return request<{ area: AreaLocation }>("/api/admin/locations/areas", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ districtId, name, ...coords }),
  });
}

export function deleteArea(token: string, id: string) {
  return fetch(`${API_URL}/api/admin/locations/areas/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then((res) => {
    if (!res.ok && res.status !== 204) throw new Error(`Request failed (${res.status})`);
  });
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
