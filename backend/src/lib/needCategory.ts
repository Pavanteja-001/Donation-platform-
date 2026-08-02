import { NeedCategory, NeedType } from "@prisma/client";

/**
 * Which donation mechanisms each cause is allowed to use.
 *
 * THIS FILE IS AUTHORITATIVE. The mobile app and both web panels carry their own copy of this
 * table to build their dropdowns, because a round trip before rendering a form is a worse trade
 * than a duplicated constant. They can drift; the server is what stops drift from mattering —
 * every create and update is validated here, so a stale client fails closed with a clear message
 * rather than writing a nonsensical pair like "ORPHANAGES + BLOOD".
 *
 * Why each mapping is what it is:
 *   - BLOOD, DONATE_ITEMS, ORPHANAGES, INTERNSHIP, SCRIBES each have exactly one sensible
 *     mechanism, so the client can skip the type question entirely and just pick it.
 *   - MEDICAL is money-only on purpose: a "medical kit" is a KIT need under a different cause,
 *     and letting MEDICAL take KIT would split hospital fundraising across two categories.
 *   - DISASTER_RELIEF is the broadest because a flood generates all three at once — cash for
 *     rebuilding, ration kits, and donated goods.
 */
export const CATEGORY_TYPES: Record<NeedCategory, NeedType[]> = {
  [NeedCategory.MEDICAL]: [NeedType.MONEY],
  [NeedCategory.BLOOD]: [NeedType.BLOOD],
  [NeedCategory.EDUCATION]: [NeedType.MONEY, NeedType.KIT],
  [NeedCategory.DONATE_ITEMS]: [NeedType.GOODS],
  [NeedCategory.WOMEN_EMPOWERMENT]: [NeedType.MONEY, NeedType.KIT, NeedType.SKILL_REQUEST],
  [NeedCategory.ANIMALS]: [NeedType.MONEY, NeedType.KIT],
  [NeedCategory.DISASTER_RELIEF]: [NeedType.MONEY, NeedType.KIT, NeedType.GOODS],
  [NeedCategory.INTERNSHIP]: [NeedType.SKILL_REQUEST],
  [NeedCategory.SCRIBES]: [NeedType.SKILL_REQUEST],
  [NeedCategory.ORPHANAGES]: [NeedType.MEAL_SLOT],
};

/** Human labels — kept beside the rules so a new category can't ship without one. */
export const CATEGORY_LABELS: Record<NeedCategory, string> = {
  [NeedCategory.MEDICAL]: "Medical",
  [NeedCategory.BLOOD]: "Blood",
  [NeedCategory.EDUCATION]: "Education",
  [NeedCategory.DONATE_ITEMS]: "Donate items",
  [NeedCategory.WOMEN_EMPOWERMENT]: "Women empowerment",
  [NeedCategory.ANIMALS]: "Animals",
  [NeedCategory.DISASTER_RELIEF]: "Disaster relief",
  [NeedCategory.INTERNSHIP]: "Internship",
  [NeedCategory.SCRIBES]: "Scribes",
  [NeedCategory.ORPHANAGES]: "Orphanages",
};

/** QUESTION needs live in the forum, not the category grid — they have no cause. */
export const CATEGORYLESS_TYPES: NeedType[] = [NeedType.QUESTION];

export interface CategoryCheck {
  ok: boolean;
  error?: string;
}

/**
 * Validates a (category, type) pair for a need being created or edited.
 *
 * A missing category is accepted rather than rejected. Requiring it outright would break every
 * caller that predates the field — including the type-specific create endpoints the panels still
 * use — and, more importantly, would make an old mobile build unable to post a need at all. The
 * field is enforced at the form layer where the user can actually answer the question; here we
 * only guarantee that whatever arrives is *coherent*.
 */
export function validateCategoryForType(
  category: NeedCategory | null | undefined,
  type: NeedType
): CategoryCheck {
  if (category === null || category === undefined) return { ok: true };

  if (CATEGORYLESS_TYPES.includes(type)) {
    return { ok: false, error: `${type} needs do not belong to a category` };
  }

  const allowed = CATEGORY_TYPES[category];
  if (!allowed.includes(type)) {
    const readable = allowed.join(", ");
    return {
      ok: false,
      error: `A ${CATEGORY_LABELS[category]} need cannot be of type ${type}. Allowed: ${readable}.`,
    };
  }
  return { ok: true };
}

/**
 * The category a type implies, when only one category can produce that type.
 *
 * Note the direction: it is NOT "this category allows only this type". MEDICAL allows only MONEY,
 * but MONEY does not imply MEDICAL — education, animals and disaster relief all raise money too.
 * Inferring from the shape of one category's list would have quietly filed every money request
 * under Medical.
 *
 * So: count the categories that CONTAIN the type. Exactly one is an inference; more is a guess,
 * and a guess shown to donors as a fact is worse than an empty field.
 *
 * In practice only BLOOD and MEAL_SLOT are inferable. MONEY, KIT, GOODS and SKILL_REQUEST each
 * span several causes and must be answered by whoever posts the need.
 */
export function inferCategoryFromType(type: NeedType): NeedCategory | null {
  const owners = (Object.keys(CATEGORY_TYPES) as NeedCategory[]).filter((c) =>
    CATEGORY_TYPES[c].includes(type)
  );
  return owners.length === 1 ? owners[0] : null;
}
