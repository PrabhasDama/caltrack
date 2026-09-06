import { describe, it, expect } from "vitest";
import fixture from "./catalog-fixture.json";
import recipes from "./phase65-recipes.json";
import type {
  CatalogFood,
  MealTemplate,
  PlanContext,
} from "@/lib/meal-plan/types";
import {
  normalizePortion,
  formatFoodQuantity,
  measurementFor,
  formatWeight,
  volumeToGrams,
} from "@/lib/food/quantities";
import {
  generatePlan,
  scaleTemplate,
  targetLoss,
  targetTolerances,
  swapMeal,
} from "@/lib/meal-plan/generator";
import { mealMacros } from "@/lib/meal-plan/calculations";
import { rankPantryMeals, rankSwaps } from "@/lib/meal-plan/discovery";
import { packageCombination } from "@/lib/shopping/packages";
import { budgetHealth } from "@/lib/budget/calculations";
const foods: CatalogFood[] = fixture.foods.map((r) => ({
  id: String(r[0]),
  name: String(r[0]),
  nutrition: {
    calories: Number(r[1]),
    protein: Number(r[2]),
    carbs: Number(r[3]),
    fat: Number(r[4]),
    fiber: Number(r[5]),
  },
  serving_g: Number(r[6]),
  piece_g: r[7] === null ? null : Number(r[7]),
  category: String(r[8]),
  tags: r[9] as string[],
  aliases: r[10] as string[],
  preparation: String(r[11]),
  source: "Test reference",
}));
const templates: MealTemplate[] = recipes.map((r) => ({
  id: r.slug,
  slug: r.slug,
  name: r.name,
  slots: r.slots,
  instructions: r.steps,
  cooking_minutes: r.prep + r.cook,
  complexity: r.skill,
  batch_friendly: r.cook > 0,
  recipe: {
    prep_minutes: r.prep,
    cook_minutes: r.cook,
    servings: 1,
    notes: r.notes,
    seasonings: r.seasonings,
    cuisine: r.cuisine,
    price_tier: r.tier,
  },
  items: r.items.map(([name, quantity, role]) => ({
    food_id: String(name),
    quantity_g: Number(quantity),
    role: role as "protein" | "carb" | "fat" | "fiber",
  })),
}));
const context: PlanContext = {
  foods,
  templates,
  targets: { calories: 2100, protein: 130, carbs: 250, fat: 64, fiber: 29 },
  preferences: {
    mealsPerDay: 3,
    restrictions: [],
    excluded: [],
    disliked: [],
    preferred: [],
    cookingMinutes: 30,
    complexity: 2,
    prepFrequency: "weekly",
    repeatTolerance: "variety",
    monthlyBudget: 300,
    currency: "USD",
  },
  today: "2026-09-05",
  days: [],
  revision: 0,
  units: "imperial",
};
describe("practical portions and measurement", () => {
  it("rounds eggs and bananas to whole natural units", () => {
    for (const [name, grams] of [
      ["Eggs", 123],
      ["Bananas", 178],
    ] as const) {
      const food = foods.find((f) => f.name === name)!;
      const normalized = normalizePortion(grams, food);
      expect(normalized % food.piece_g!).toBe(0);
      expect(formatFoodQuantity(normalized, food, "imperial")).not.toMatch(
        /\d\.\d.*(egg|banana)/,
      );
    }
  });
  it("normalizes weight foods and uses precisely those grams for nutrition", () => {
    const f = foods.find((f) => f.name === "Tofu")!;
    expect(normalizePortion(213, f, 0, 1000, "metric")).toBe(225);
    const meal = scaleTemplate(
      templates.find((t) => t.slug === "tofu-rice")!,
      foods,
      635,
      "Dinner",
      "test",
      "metric",
    );
    expect(meal.macros).toEqual(mealMacros(meal.ingredients, foods));
    expect(meal.ingredients.every((i) => i.quantity_g > 0)).toBe(true);
  });
  it("preserves base recipe ratios within one practical rounding step", () => {
    const t = templates.find((t) => t.slug === "chicken-rice")!;
    const m = scaleTemplate(
      t,
      foods,
      mealMacros(t.items, foods).calories * 1.5,
      "Dinner",
      "test",
      "metric",
    );
    for (const i of m.ingredients) {
      const base = t.items.find((b) => b.food_id === i.food_id)!;
      expect(
        Math.abs(i.quantity_g - base.quantity_g * 1.5),
      ).toBeLessThanOrEqual(13);
    }
  });
  it("uses country defaults with explicit overrides", () => {
    expect(measurementFor("US")).toBe("imperial");
    expect(measurementFor("CA")).toBe("metric");
    expect(measurementFor("CA", "imperial")).toBe("imperial");
    expect(formatWeight(453.59237, "imperial")).toBe("1 lb");
    expect(formatWeight(1000, "metric")).toBe("1 kg");
  });
  it("requires density for volume conversion", () => {
    expect(() => volumeToGrams(1, "cup", null)).toThrow("density");
    expect(volumeToGrams(1, "L", 1)).toBe(1000);
    expect(volumeToGrams(1, "tbsp", 0.91)).toBeCloseTo(13.455956, 4);
  });
  it("uses explicit target tolerances rather than requiring exact equality", () => {
    expect(
      targetLoss({ ...context.targets, calories: 2200 }, context.targets),
    ).toBe(0);
    expect(Object.keys(targetTolerances)).toHaveLength(5);
  });
});
describe("recipe variety, swaps and pantry discovery", () => {
  it("has substantial distinct recipes across every meal slot", () => {
    expect(templates.length).toBeGreaterThanOrEqual(40);
    for (const slot of ["Breakfast", "Lunch", "Dinner", "Snack"])
      expect(
        templates.filter((t) => t.slots.includes(slot)).length,
      ).toBeGreaterThanOrEqual(8);
  });
  it("regenerates materially different valid meals from the current day", () => {
    const first = generatePlan(context, context.today, 1);
    const second = generatePlan({ ...context, days: first }, context.today, 1);
    expect(
      second[0].meals.every(
        (m, i) => m.template_id !== first[0].meals[i].template_id,
      ),
    ).toBe(true);
  });
  it("limits repetition across a variety week", () => {
    const days = generatePlan(context, context.today, 7);
    expect(
      new Set(days.flatMap((d) => d.meals.map((m) => m.template_id))).size,
    ).toBeGreaterThan(12);
  });
  it("never swaps a completed meal", () => {
    const day = generatePlan(context, context.today, 1)[0];
    day.meals[0].status = "completed";
    expect(() => swapMeal(day, 0, templates[0], context)).toThrow(
      "Only uneaten",
    );
  });
  it("filters swaps by meaningful protein and calorie changes", () => {
    const meal = generatePlan(context, context.today, 1)[0].meals[0];
    for (const c of rankSwaps(context, meal, "Higher Protein"))
      expect(c.meal.macros.protein).toBeGreaterThan(meal.macros.protein);
    for (const c of rankSwaps(context, meal, "Lower Calorie"))
      expect(c.meal.macros.calories).toBeLessThan(meal.macros.calories);
  });
  it("ranks fully pantry-covered recipes ahead of missing ingredients", () => {
    const chosen = scaleTemplate(
      templates.find((t) => t.slug === "chicken-rice")!,
      foods,
      700,
      "Dinner",
      "pantry",
      "imperial",
    );
    const pantry = chosen.ingredients.map((i, n) => ({
      id: String(n),
      food_id: i.food_id,
      quantity_g: 5000,
      low_threshold_g: 100,
      display_unit: "g" as const,
      purchased_on: null,
      expires_on: null,
      updated_at: "2026-09-05",
    }));
    const ranked = rankPantryMeals(
      { ...context, pantry },
      "Dinner",
      "Use Pantry First",
    );
    expect(ranked[0].estimate.coverage).toBe(1);
    expect(ranked[0].estimate.missing).toHaveLength(0);
    expect(ranked.some((r) => r.estimate.coverage < 1)).toBe(true);
  });
  it("ignores expired inventory and does not fabricate missing prices", () => {
    const ranked = rankPantryMeals(
      {
        ...context,
        pantry: [
          {
            id: "x",
            food_id: "Chicken breast",
            quantity_g: 5000,
            low_threshold_g: 100,
            display_unit: "g",
            purchased_on: null,
            expires_on: "2026-09-01",
            updated_at: "2026-09-01",
          },
        ],
      },
      "Dinner",
      "Lowest Extra Spend",
    );
    expect(ranked.every((r) => r.estimate.coverage === 0)).toBe(true);
    expect(ranked.every((r) => r.estimate.cost === null)).toBe(true);
  });
});
describe("packages and budget signals", () => {
  const p = (id: string, grams: number) => ({
    id,
    food_id: "Eggs",
    name: id,
    package_amount: grams,
    package_unit: "g",
    package_grams: grams,
  });
  it("maps 8 eggs to one dozen and retains the leftover weight", () => {
    const r = packageCombination(400, [p("dozen", 600)])!;
    expect(r.packages[0].quantity).toBe(1);
    expect(r.grams).toBe(600);
    expect(r.leftoverG).toBe(200);
  });
  it("finds the smallest sufficient mixed package combination", () => {
    const r = packageCombination(850, [p("small", 300), p("large", 500)])!;
    expect(r.grams).toBe(900);
    expect(r.packages[0].quantity).toBe(3);
    expect(packageCombination(1, [])).toBeNull();
  });
  it("handles unknown weights without invented package quantities", () => {
    expect(
      packageCombination(300, [{ ...p("unknown", 1), package_grams: null }]),
    ).toBeNull();
  });
  it("shows budget states and suppresses weak projections", () => {
    expect(budgetHealth(250, 118, 3, "2026-09", "2026-09-12").status).toBe(
      "Trending over budget",
    );
    expect(budgetHealth(100, 95, 1, "2026-09", "2026-09-05").status).toBe(
      "Near limit",
    );
    expect(budgetHealth(100, 101, 1, "2026-09", "2026-09-05").status).toBe(
      "Over budget",
    );
    expect(
      budgetHealth(100, 10, 1, "2026-09", "2026-09-05").weeklyAverage,
    ).toBeNull();
  });
});
