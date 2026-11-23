import { describe, expect, it } from "vitest";
import type { MenuDish } from "../types";
import { rankMenuDishes } from "./menuRecommendations";

const dishes: MenuDish[] = [
  {
    id: "classic-burger",
    name: "Classic Burger",
    description: "Single beef patty, lettuce, tomato, and special sauce",
    category: "burgers",
    preparation: ["griddled"],
    positives: ["single patty", "vegetable toppings"],
    concerns: ["high-sodium"],
    evidence: "menu-inferred",
    sourceText: "Classic Burger — single beef patty, lettuce, tomato, special sauce",
  },
  {
    id: "fried-chicken-sandwich",
    name: "Fried Chicken Sandwich",
    description: "Crispy chicken, pickles, and sauce",
    category: "chicken",
    preparation: ["fried"],
    positives: ["protein"],
    concerns: ["fried", "seed-oil-likely"],
    evidence: "menu-inferred",
    sourceText: "Fried Chicken Sandwich — crispy chicken, pickles, sauce",
  },
  {
    id: "garden-salad",
    name: "Garden Salad",
    description: "Mixed vegetables",
    category: "salads",
    preparation: ["raw"],
    positives: ["vegetables", "fiber"],
    concerns: [],
    evidence: "restaurant-verified",
    sourceText: "Garden Salad — mixed vegetables",
  },
];

describe("rankMenuDishes", () => {
  it("preserves the selected craving instead of promoting an unrelated healthy dish", () => {
    const ranked = rankMenuDishes({ dishes, craving: "burgers" });

    expect(ranked.map((dish) => dish.id)).toEqual(["classic-burger", "fried-chicken-sandwich"]);
    expect(ranked[0].cravingMatch).toBe("closest");
  });

  it("applies a stronger penalty when a concern conflicts with a user avoidance", () => {
    const withoutPreference = rankMenuDishes({ dishes, craving: "chicken" });
    const avoidingSeedOils = rankMenuDishes({ dishes, craving: "chicken", foodsToAvoid: ["seed-oils"] });

    const baselineSandwich = withoutPreference.find((dish) => dish.id === "fried-chicken-sandwich");
    const preferenceSandwich = avoidingSeedOils.find((dish) => dish.id === "fried-chicken-sandwich");

    expect(preferenceSandwich?.recommendationScore).toBeLessThan(baselineSandwich?.recommendationScore ?? 0);
    expect(preferenceSandwich?.suggestedChange).toContain("grilled");
  });

  it("keeps the selected format ahead of a better-scoring different format", () => {
    const burger: MenuDish = { ...dishes[0], concerns: ["fried", "seed-oil-likely", "high-sodium", "dairy"] };
    const sandwich: MenuDish = { ...dishes[1], concerns: [] };
    const ranked = rankMenuDishes({ dishes: [sandwich, burger], craving: "burgers", foodsToAvoid: ["seed-oils", "high-sodium", "dairy"] });
    expect(ranked.map((dish) => dish.id)).toEqual([burger.id, sandwich.id]);
  });

  it("requires an identifiable match for the chosen craving", () => {
    const special: MenuDish = { ...dishes[2], category: "other" };
    const wings: MenuDish = { ...dishes[1], name: "Buffalo Wings" };
    for (const craving of ["drinks", "desserts", "pizza", "sides", "burgers"] as const) {
      expect(rankMenuDishes({ dishes: [special, wings], craving })).toEqual([]);
    }
    expect(rankMenuDishes({ dishes: [dishes[0]], craving: "chicken" })).toEqual([]);
  });

  it("uses stable alphabetical ordering when scores tie", () => {
    const tie = [
      { ...dishes[0], id: "z", name: "Z Burger" },
      { ...dishes[0], id: "a", name: "A Burger" },
    ];

    expect(rankMenuDishes({ dishes: tie, craving: "burgers" }).map((dish) => dish.name)).toEqual(["A Burger", "Z Burger"]);
  });
});
