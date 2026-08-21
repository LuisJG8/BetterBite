import type {
  FoodAvoidance,
  MenuConcern,
  MenuCravingCategory,
  MenuDish,
  MenuDishRecommendation,
} from "../types";

const RELATED_CATEGORIES: Partial<Record<MenuCravingCategory, MenuCravingCategory[]>> = {
  burgers: ["chicken"],
  chicken: ["burgers", "bowls"],
  pizza: ["other"],
  tacos: ["bowls"],
  bowls: ["tacos", "salads"],
  salads: ["bowls"],
  sides: ["other"],
  drinks: [],
  desserts: [],
};

const AVOIDANCE_CONCERNS: Partial<Record<FoodAvoidance, MenuConcern[]>> = {
  "added-sugars": ["added-sugar"],
  dairy: ["dairy"],
  gluten: ["gluten"],
  "high-sodium": ["high-sodium", "processed-meat"],
  "seed-oils": ["seed-oil-likely", "fried"],
};

const CONCERN_PENALTIES: Record<MenuConcern, number> = {
  "added-sugar": 8,
  dairy: 3,
  fried: 8,
  gluten: 3,
  "high-sodium": 7,
  "processed-meat": 6,
  "seed-oil-likely": 7,
};

export function rankMenuDishes({
  dishes,
  craving,
  foodsToAvoid = [],
}: {
  dishes: MenuDish[];
  craving: MenuCravingCategory;
  foodsToAvoid?: FoodAvoidance[];
}): MenuDishRecommendation[] {
  return dishes
    .map((dish) => toRecommendation(dish, craving, foodsToAvoid))
    .filter((dish): dish is MenuDishRecommendation => dish !== null)
    .sort((left, right) => right.recommendationScore - left.recommendationScore || left.name.localeCompare(right.name));
}

function toRecommendation(
  dish: MenuDish,
  craving: MenuCravingCategory,
  foodsToAvoid: FoodAvoidance[],
): MenuDishRecommendation | null {
  const cravingMatch = getCravingMatch(dish.category, craving);
  if (!cravingMatch) {
    return null;
  }

  const categoryScore = cravingMatch === "closest" ? 100 : cravingMatch === "strong" ? 68 : 45;
  const concernPenalty = dish.concerns.reduce((total, concern) => total + CONCERN_PENALTIES[concern], 0);
  const preferencePenalty = dish.concerns.reduce(
    (total, concern) => total + (foodsToAvoid.some((avoidance) => AVOIDANCE_CONCERNS[avoidance]?.includes(concern)) ? 18 : 0),
    0,
  );
  const positiveBonus = Math.min(12, dish.positives.length * 4);
  const evidenceBonus = dish.evidence === "restaurant-verified" ? 5 : dish.evidence === "menu-inferred" ? 2 : 0;
  const recommendationScore = clamp(categoryScore + positiveBonus + evidenceBonus - concernPenalty - preferencePenalty, 0, 120);

  return {
    ...dish,
    cravingMatch,
    recommendationScore,
    reason: buildReason(dish, cravingMatch),
    suggestedChange: getSuggestedChange(dish.concerns),
  };
}

function getCravingMatch(
  category: MenuCravingCategory,
  craving: MenuCravingCategory,
): MenuDishRecommendation["cravingMatch"] | null {
  if (category === craving) {
    return "closest";
  }

  if (RELATED_CATEGORIES[craving]?.includes(category)) {
    return "strong";
  }

  return category === "other" ? "related" : null;
}

function buildReason(dish: MenuDish, match: MenuDishRecommendation["cravingMatch"]): string {
  const matchCopy = match === "closest" ? "Keeps the same craving and meal format" : "Stays close to the same eating occasion";
  const positiveCopy = dish.positives[0] ? ` with ${dish.positives[0].toLowerCase()}` : "";
  return `${matchCopy}${positiveCopy}.`;
}

function getSuggestedChange(concerns: MenuConcern[]): string | undefined {
  if (concerns.includes("fried")) {
    return "Ask whether a grilled version is available.";
  }
  if (concerns.includes("added-sugar")) {
    return "Ask for the sweet sauce or syrup on the side.";
  }
  if (concerns.includes("high-sodium")) {
    return "Ask for salty sauces or seasoning on the side.";
  }
  if (concerns.includes("dairy")) {
    return "Ask whether cheese or creamy sauce can be left off.";
  }
  return undefined;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
