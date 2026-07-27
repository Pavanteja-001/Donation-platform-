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
  email: string | null;
  name: string | null;
  role: Role;
  city: string | null;
  area: string | null;
  profilePhotoUrl: string | null;
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

export type TrustTier = "BRONZE" | "SILVER" | "GOLD";

// PRD §14.1 — computed fresh server-side on every /api/auth/me read, never stored. Any role can
// have one (Institutions can also donate, PRD §4).
export interface TrustTierInfo {
  trustTier: TrustTier;
  confirmedContributionsCount: number;
  // Distance to the next tier. Thresholds are a server-side business rule and must never be
  // hardcoded here. Optional so the app degrades gracefully against a backend deployed before
  // these fields existed — callers should treat `undefined` as "progress unknown", not "at top".
  nextTier?: TrustTier | null;
  nextTierAt?: number | null;
  contributionsToNextTier?: number | null;
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
  latitude: number | null;
  longitude: number | null;
  deadline: string | null;
  rejectionReason: string | null;
  photos: string[];
  linkedInstitutionId: string | null;
  institutionVerified: boolean;
  adminVerified: boolean;
  payload: MoneyPayload | KitPayload | BloodPayload | MealSlotPayload | GoodsPayload | Record<string, unknown> | null;
  // Only ever non-empty for MEAL_SLOT needs (§10.2).
  //
  // OPTIONAL ON PURPOSE: only `GET /needs/:id` includes this relation. The list endpoints
  // (`GET /needs`, `GET /needs/mine`) do not, and the feed hands its partial need straight to
  // the detail screen as `initialNeed` — which renders before the full refetch lands. Typing
  // this as a required array was a lie about those responses and crashed the detail screen on
  // MEAL_SLOT needs. Always read it as `need.mealSlots ?? []`.
  mealSlots?: MealSlot[];
  postedBy: { id: string; name: string | null; role: Role };
  createdAt: string;
}

// Mirrors the backend `ContributionKind` Prisma enum. SKILL_REQUEST is a real value the API can
// return (volunteer pledges) — it was missing here, so that response shape was untypeable.
export type ContributionKind = "MONEY" | "KIT" | "BLOOD" | "MEAL_SLOT" | "GOODS" | "SKILL_REQUEST";
export type ContributionStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";

export interface Contribution {
  id: string;
  needId: string;
  kind: ContributionKind;
  // BLOOD only — units pledged, usually 1 (§8.5). Null for MONEY/KIT/MEAL_SLOT.
  units: number | null;
  // MONEY: amount always set. KIT/MEAL_SLOT mode=MONEY: amount set (+kits for KIT). KIT/
  // MEAL_SLOT mode=DELIVER: amount null, utr null (§9.2/§10.4 — no payment for a physical
  // delivery / in-person pledge).
  amount: number | null;
  kits: number | null;
  // MEAL_SLOT only — the calendar date this contribution booked (§10.4).
  mealSlotDate: string | null;
  status: ContributionStatus;
  utr: string | null;
  donor: { id: string; name: string | null; phone: string };
  createdAt: string;
  // Only present on GET /api/contributions/mine (§14.3) — every other contributions endpoint is
  // scoped to one already-known need.
  need?: { id: string; title: string; type: NeedType };
}

// PRD §14.2 — a derived view over a CONFIRMED contribution, not a stored record.
export interface Certificate {
  certificateId: string;
  donorName: string;
  needTitle: string;
  needType: NeedType;
  summary: string;
  confirmedAt: string;
  disclaimer: string;
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

export function requestOtp(phone: string) {
  return request<{ ok: true; registered: boolean }>("/api/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyOtp(phone: string, code: string, name?: string) {
  return request<{ token: string; user: AuthUser; bloodEligibility: BloodEligibility } & TrustTierInfo>(
    "/api/auth/otp/verify",
    {
      method: "POST",
      // role omitted — self-registration through the mobile app is always the USER
      // (donor/beneficiary) role; INSTITUTION accounts register from the web panel.
      body: JSON.stringify({ phone, code, name }),
    }
  );
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser; bloodEligibility: BloodEligibility } & TrustTierInfo>("/api/auth/me", {
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
    email: string | null;
    city: string;
    area: string;
    profilePhotoUrl: string | null;
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

export interface DistrictLocation {
  id: string;
  name: string;
  state: string;
  areas: string[];
}

export function fetchLocations() {
  return request<{ districts: DistrictLocation[] }>("/api/locations");
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
  return request<{ need: Need; myContribution?: { id: string; status: string; kind: string } | null }>(`/api/needs/${id}`, {
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
    headers: { Authorization: `Bearer ${token}` },
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
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §10.1-10.2 — creates a DRAFT MEAL_SLOT need with one MealSlot row per date, then
// immediately submits it (mirrors postMoneyNeed/postKitNeed). `dates` are plain "YYYY-MM-DD"
// strings — the backend dedupes by calendar day and creates the MealSlot rows atomically.
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
    headers: { Authorization: `Bearer ${token}` },
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
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §10.3/§10.4 / D-022 — book one specific date. `utr` required for mode=MONEY, must be
// omitted for mode=DELIVER, same shape as KIT donations; the backend enforces this too. A 409
// here means someone else booked this exact date first (the whole point of the locking) — the
// caller should refetch the need and let the donor pick another date.
export function bookMealSlot(
  token: string,
  needId: string,
  slotId: string,
  data: { utr?: string; proofUrl?: string }
) {
  return request<{ contribution: Contribution }>(`/api/needs/${needId}/meal-slots/${slotId}/book`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// Object storage (CLAUDE.md §6 / D-011): the backend only signs a short-lived upload URL — the
// client uploads the file bytes straight to the bucket, never through the backend.
export function signUpload(token: string, contentType: string, folder: "contribution-proofs" | "need-photos" | "need-qr" | "kyc-docs" | "profile-photos") {
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

// PRD §11.1 — creates a DRAFT GOODS need, then immediately submits it (mirrors postBloodNeed).
export async function postGoodsNeed(
  token: string,
  data: { title: string; description: string; item: string; condition: string; photos?: string[] }
) {
  const { need } = await request<{ need: Need }>("/api/needs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §11.3 — "claim it": a pledge, never a payment, same consent principle as blood's respond.
export function claimGoods(token: string, needId: string, proofUrl?: string) {
  return request<{ contribution: Contribution }>(`/api/needs/${needId}/contributions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ proofUrl }),
  });
}

// PRD §13 — SKILL_REQUEST: post + immediately submit, same two-step as GOODS.
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
    headers: { Authorization: `Bearer ${token}` },
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
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §13.3 — volunteer pledge (no payment)
export function volunteerForNeed(token: string, needId: string) {
  return request<{ contribution: Contribution }>(`/api/needs/${needId}/contributions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export function fetchContributions(token: string, needId: string) {
  return request<{ contributions: Contribution[] }>(`/api/needs/${needId}/contributions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §14.3 — every contribution the caller has made, across every need, most recent first.
export function fetchMyContributions(token: string) {
  return request<{ contributions: Contribution[] }>("/api/contributions/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §14.2 — 409s if the contribution isn't CONFIRMED yet.
export function fetchCertificate(token: string, contributionId: string) {
  return request<{ certificate: Certificate }>(`/api/contributions/${contributionId}/certificate`, {
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

export async function uploadProfilePhoto(token: string, fileUri: string, contentType: string): Promise<string> {
  const signed = await signUpload(token, contentType, "profile-photos");
  await uploadToSignedUrl(signed.uploadUrl, fileUri, contentType);
  return signed.publicUrl;
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
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchForumQuestion(token: string, id: string) {
  return request<{ question: ForumQuestion }>(`/api/forum/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function askForumQuestion(token: string, data: { title: string; body: string }) {
  return request<{ question: ForumQuestion }>("/api/forum", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function answerForumQuestion(token: string, questionId: string, body: string) {
  return request<{ answer: ForumAnswer }>(`/api/forum/${questionId}/answers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  });
}

export function deleteForumQuestion(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/forum/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteForumAnswer(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/forum/answers/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// PRD §13 — SKILL_REQUEST volunteering payload
export interface SkillRequestPayload {
  role_needed: string;
  volunteers_needed: number;
  volunteers_joined: number;
  date: string;
  time: string;
}

