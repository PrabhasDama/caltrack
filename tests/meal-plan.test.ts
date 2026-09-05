import { describe, it, expect } from "vitest";
import fixture from "./catalog-fixture.json";
import {
  mealMacros,
  dayMacros,
  targetDelta,
} from "@/lib/meal-plan/calculations";
import { generatePlan, scaleTemplate } from "@/lib/meal-plan/generator";
import {
  allowedTemplates,
  allowedFood,
  matchesFood,
} from "@/lib/meal-plan/restrictions";
import type {
  CatalogFood,
  MealTemplate,
  PlanContext,
} from "@/lib/meal-plan/types";
const foods: CatalogFood[] = fixture.foods.map((row, index) => {
  const [
    name,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    serving_g,
    piece_g,
    category,
    tags,
    aliases,
    preparation,
  ] = row as [
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    number | null,
    string,
    string[],
    string[],
    string,
  ];
  return {
    id: String(index),
    name,
    category,
    tags,
    aliases,
    preparation,
    serving_g,
    piece_g,
    nutrition: { calories, protein, carbs, fat, fiber },
    source: "test reference",
  };
});
const templates: MealTemplate[] = fixture.templates.map((row, index) => {
  const [
    slug,
    name,
    slots,
    cooking_minutes,
    complexity,
    batch_friendly,
    items,
    instructions,
  ] = row as [
    string,
    string,
    string[],
    number,
    number,
    boolean,
    [string, number, "protein" | "carb" | "fat" | "fiber"][],
    string[],
  ];
  return {
    id: String(index),
    slug,
    name,
    slots,
    cooking_minutes,
    complexity,
    batch_friendly,
    instructions,
    items: items.map(([name, quantity_g, role]) => ({
      food_id: foods.find((f) => f.name === name)!.id,
      quantity_g,
      role,
    })),
  };
});
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
    repeatTolerance: "some",
    monthlyBudget: 300,
    currency: "USD",
  },
  today: "2026-09-05",
  days: [],
  revision: 0,
};
describe("deterministic meal planning", () => {
  it("derives exact ingredient nutrition from per-100g amounts", () => {
    const rice = foods.find((f) => f.name === "Rice")!;
    const m = mealMacros([{ food_id: rice.id, quantity_g: 200 }], foods);
    expect(m.calories).toBe(730);
    expect(m.carbs).toBe(160);
  });
  it("rejects unknown foods and invalid amounts", () => {
    expect(() =>
      mealMacros([{ food_id: "missing", quantity_g: 100 }], foods),
    ).toThrow();
    expect(() =>
      mealMacros([{ food_id: "0", quantity_g: -1 }], foods),
    ).toThrow();
  });
  it("scales calories and bounds practical portions", () => {
    const t = templates[0];
    const base = mealMacros(t.items, foods);
    const m = scaleTemplate(t, foods, base.calories * 2, "Breakfast", "test");
    expect(m.ingredients[0].quantity_g).toBe(t.items[0].quantity_g * 2);
    expect(m.macros.calories).toBeCloseTo(base.calories * 2, 0);
  });
  it("generates seven reproducible days near daily energy targets", () => {
    const a = generatePlan(context, context.today, 7);
    expect(a).toEqual(generatePlan(context, context.today, 7));
    expect(a).toHaveLength(7);
    expect(a[6].date).toBe("2026-09-11");
    for (const day of a) {
      expect(day.meals).toHaveLength(3);
      expect(Math.abs(dayMacros(day).calories - 2100)).toBeLessThan(300);
    }
  });
  it("keeps peanut butter out when peanuts are excluded", () => {
    const prefs = { ...context.preferences, excluded: ["Peanuts"] };
    const peanut = foods.find((f) => f.name === "Peanut butter")!;
    expect(matchesFood(peanut, "peanuts")).toBe(true);
    expect(allowedFood(peanut, prefs)).toBe(false);
    const days = generatePlan(
      { ...context, preferences: prefs },
      context.today,
      3,
    );
    expect(
      days
        .flatMap((d) => d.meals.flatMap((m) => m.ingredients))
        .some((i) => i.food_id === peanut.id),
    ).toBe(false);
  });
  it("honors vegan, gluten-free, disliked foods, and time limits together", () => {
    const prefs = {
      ...context.preferences,
      restrictions: ["Vegan", "Gluten-free"],
      disliked: ["Tofu"],
      cookingMinutes: 20,
    };
    const allowed = allowedTemplates(templates, foods, prefs);
    expect(allowed.length).toBeGreaterThan(0);
    for (const t of allowed)
      for (const i of t.items) {
        const f = foods.find((f) => f.id === i.food_id)!;
        expect(f.tags).toContain("vegan");
        expect(f.tags).not.toContain("gluten");
        expect(f.name).not.toBe("Tofu");
      }
  });
  it("fails clearly rather than ignoring exclusions when no template fits", () => {
    expect(() =>
      generatePlan(
        {
          ...context,
          preferences: {
            ...context.preferences,
            excluded: foods.map((f) => f.name),
          },
        },
        context.today,
        1,
      ),
    ).toThrow("No breakfast template");
  });
  it("supports two through five meals and repeat preferences", () => {
    for (const count of [2, 3, 4, 5]) {
      const days = generatePlan(
        {
          ...context,
          preferences: {
            ...context.preferences,
            mealsPerDay: count,
            repeatTolerance: "repeat",
          },
        },
        context.today,
        2,
      );
      expect(days[0].meals).toHaveLength(count);
      expect(days[0].meals.map((m) => m.template_id)).toEqual(
        days[1].meals.map((m) => m.template_id),
      );
    }
  });
  it("shows all macro differences for a swap", () => {
    expect(
      targetDelta(
        { calories: 500, protein: 40, carbs: 45, fat: 15, fiber: 8 },
        { calories: 450, protein: 35, carbs: 40, fat: 10, fiber: 10 },
      ),
    ).toEqual({ calories: 50, protein: 5, carbs: 5, fat: 5, fiber: -2 });
  });
});
