import type { NeedType } from "./api";

/**
 * Causes a need can serve — the second axis alongside `NeedType`, which says how someone gives.
 *
 * MIRRORS backend/src/lib/needCategory.ts, WHICH IS AUTHORITATIVE. This copy exists so the post
 * form can render without a round trip first. If the two drift, the server rejects the pair with
 * a readable error rather than storing something incoherent — so drift degrades to a failed
 * submit, never to a need filed under the wrong cause.
 */
export type NeedCategory =
  | "MEDICAL"
  | "BLOOD"
  | "EDUCATION"
  | "DONATE_ITEMS"
  | "WOMEN_EMPOWERMENT"
  | "ANIMALS"
  | "DISASTER_RELIEF"
  | "INTERNSHIP"
  | "SCRIBES"
  | "ORPHANAGES";

export interface CategoryMeta {
  id: NeedCategory;
  label: string;
  hint: string;
  /** Allowed need types, in the order the picker should offer them. */
  types: NeedType[];
}

/** `types.length === 1` lets the picker skip a question that has exactly one answer. */
export const CATEGORIES: CategoryMeta[] = [
  { id: "MEDICAL", label: "Medical", hint: "Treatment, surgery or hospital bills", types: ["MONEY"] },
  { id: "BLOOD", label: "Blood", hint: "Request a blood group, eligibility-matched", types: ["BLOOD"] },
  { id: "EDUCATION", label: "Education", hint: "School fees, books, uniforms", types: ["MONEY", "KIT"] },
  { id: "DONATE_ITEMS", label: "Donate items", hint: "Give away or request unused things", types: ["GOODS"] },
  {
    id: "WOMEN_EMPOWERMENT",
    label: "Women empowerment",
    hint: "Training, livelihood and support programmes",
    types: ["MONEY", "KIT", "SKILL_REQUEST"],
  },
  { id: "ANIMALS", label: "Animals", hint: "Rescue, feed or treat animals", types: ["MONEY", "KIT"] },
  {
    id: "DISASTER_RELIEF",
    label: "Disaster relief",
    hint: "Floods, cyclones and emergencies",
    types: ["MONEY", "KIT", "GOODS"],
  },
  { id: "ORPHANAGES", label: "Orphanages", hint: "Sponsor meals on specific dates", types: ["MEAL_SLOT"] },
  { id: "INTERNSHIP", label: "Internship", hint: "Offer or request an internship", types: ["SKILL_REQUEST"] },
  { id: "SCRIBES", label: "Scribes", hint: "Writers for exams and paperwork", types: ["SKILL_REQUEST"] },
];

/** Post-form route per need type — the panels navigate by path, not by route name. */
export const TYPE_PATHS: Record<NeedType, string | null> = {
  MONEY: "/post/money",
  KIT: "/post/kit",
  BLOOD: "/post/blood",
  MEAL_SLOT: "/post/meal-slot",
  GOODS: "/post/goods",
  SKILL_REQUEST: "/post/skill-request",
  // Questions are asked in the forum, not posted as needs.
  QUESTION: null,
};

/** How each mechanism reads *inside* a category, where the cause is already known. */
export const TYPE_LABELS: Record<NeedType, string> = {
  MONEY: "Raise money",
  KIT: "Kits",
  BLOOD: "Blood",
  MEAL_SLOT: "Meal slots",
  GOODS: "An item",
  SKILL_REQUEST: "Volunteers",
  QUESTION: "Question",
};

export const CATEGORY_LABELS: Record<NeedCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
) as Record<NeedCategory, string>;
