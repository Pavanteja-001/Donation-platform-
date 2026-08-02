import type { NeedType } from "./api";

/**
 * Causes a need can serve — the second axis alongside `NeedType`, which says how someone gives.
 *
 * MIRRORS backend/src/lib/needCategory.ts, WHICH IS AUTHORITATIVE. This copy exists so the create
 * form can render without a round trip first. If the two ever drift, the server rejects the pair
 * with a readable error rather than storing something incoherent — so drift degrades to a failed
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

/** Which route creates each need type — used to send the poster straight to the right form. */
export type CreateRoute =
  | "CreateMoney"
  | "CreateKit"
  | "CreateBlood"
  | "CreateMealSlot"
  | "CreateGoods"
  | "CreateSkillRequest";

export const TYPE_ROUTES: Record<NeedType, CreateRoute | null> = {
  MONEY: "CreateMoney",
  KIT: "CreateKit",
  BLOOD: "CreateBlood",
  MEAL_SLOT: "CreateMealSlot",
  GOODS: "CreateGoods",
  SKILL_REQUEST: "CreateSkillRequest",
  // Questions are asked in the forum, not posted as needs.
  QUESTION: null,
};

export interface CategoryMeta {
  id: NeedCategory;
  label: string;
  /** Plain-language description of the cause, not of the mechanism. */
  hint: string;
  /** Bundled artwork — see assets/icons. */
  icon: number;
  /** Allowed need types, in the order the picker should offer them. */
  types: NeedType[];
}

/**
 * The eleven tiles, in the order the design lays them out.
 *
 * `types.length === 1` is what lets the picker skip a question entirely: choosing Blood can only
 * mean a BLOOD need, so asking "and how would you like to give?" afterwards would be a step that
 * has exactly one answer.
 */
export const CATEGORIES: CategoryMeta[] = [
  {
    id: "MEDICAL",
    label: "Medical",
    hint: "Treatment, surgery or hospital bills",
    icon: require("../../assets/icons/medical.webp"),
    types: ["MONEY"],
  },
  {
    id: "BLOOD",
    label: "Blood",
    hint: "Request a blood group, eligibility-matched",
    icon: require("../../assets/icons/blood.webp"),
    types: ["BLOOD"],
  },
  {
    id: "EDUCATION",
    label: "Education",
    hint: "School fees, books, uniforms",
    icon: require("../../assets/icons/education.webp"),
    types: ["MONEY", "KIT"],
  },
  {
    id: "DONATE_ITEMS",
    label: "Donate items",
    hint: "Give away or request unused things",
    icon: require("../../assets/icons/donate-items.webp"),
    types: ["GOODS"],
  },
  {
    id: "WOMEN_EMPOWERMENT",
    label: "Women empowerment",
    hint: "Training, livelihood and support programmes",
    icon: require("../../assets/icons/women-empowerment.webp"),
    types: ["MONEY", "KIT", "SKILL_REQUEST"],
  },
  {
    id: "ANIMALS",
    label: "Animals",
    hint: "Rescue, feed or treat animals",
    icon: require("../../assets/icons/animals.webp"),
    types: ["MONEY", "KIT"],
  },
  {
    id: "DISASTER_RELIEF",
    label: "Disaster relief",
    hint: "Floods, cyclones and emergencies",
    icon: require("../../assets/icons/disaster-relief.webp"),
    types: ["MONEY", "KIT", "GOODS"],
  },
  {
    id: "ORPHANAGES",
    label: "Orphanages",
    hint: "Sponsor meals on specific dates",
    icon: require("../../assets/icons/orphanages.webp"),
    types: ["MEAL_SLOT"],
  },
  {
    id: "INTERNSHIP",
    label: "Internship",
    hint: "Offer or request an internship",
    icon: require("../../assets/icons/internship.webp"),
    types: ["SKILL_REQUEST"],
  },
  {
    id: "SCRIBES",
    label: "Scribes",
    hint: "Writers for exams and paperwork",
    icon: require("../../assets/icons/scribes.webp"),
    types: ["SKILL_REQUEST"],
  },
];

/** How each mechanism is described *inside* a category, where the cause is already known. */
export const TYPE_LABELS: Record<NeedType, string> = {
  MONEY: "Raise money",
  KIT: "Kits",
  BLOOD: "Blood",
  MEAL_SLOT: "Meal slots",
  GOODS: "An item",
  SKILL_REQUEST: "Volunteers",
  QUESTION: "Question",
};

export const TYPE_HINTS: Record<NeedType, string> = {
  MONEY: "Fund a target amount",
  KIT: "Funded or delivered kits",
  BLOOD: "Eligibility-matched donors",
  MEAL_SLOT: "Sponsor calendar dates",
  GOODS: "Someone claims and gives it",
  SKILL_REQUEST: "Skilled volunteers for a task",
  QUESTION: "Ask the community",
};

export function categoryById(id: NeedCategory): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Derived from CATEGORIES so a label can never be defined in one place and forgotten in another. */
export const CATEGORY_LABELS: Record<NeedCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
) as Record<NeedCategory, string>;
