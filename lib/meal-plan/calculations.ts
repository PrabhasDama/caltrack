import { emptyMacros, sumMacros, type Macros } from "@/lib/nutrition/macros";
import type { CatalogFood, PlannedMeal, PlanDay } from "./types";
export function round(value: number, places = 1) {
  return Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;
}
export function mealMacros(
  items: { food_id: string; quantity_g: number }[],
  foods: CatalogFood[],
): Macros {
  const result = { ...emptyMacros };
  for (const item of items) {
    const food = foods.find((f) => f.id === item.food_id);
    if (!food) throw new Error("Nutrition is missing for an ingredient.");
    if (!Number.isFinite(item.quantity_g) || item.quantity_g <= 0)
      throw new Error("Ingredient quantities must be positive.");
    for (const key of Object.keys(result) as (keyof Macros)[])
      result[key] += (food.nutrition[key] * item.quantity_g) / 100;
  }
  return Object.fromEntries(
    Object.entries(result).map(([k, v]) => [k, round(v)]),
  ) as Macros;
}
export function dayMacros(day: PlanDay): Macros {
  return sumMacros(day.meals.map((m) => m.macros));
}
export function targetDelta(planned: Macros, target: Macros): Macros {
  return Object.fromEntries(
    Object.keys(target).map((k) => [
      k,
      round(planned[k as keyof Macros] - target[k as keyof Macros]),
    ]),
  ) as Macros;
}
export function planWarnings(day: PlanDay, target: Macros) {
  const actual = dayMacros(day);
  const warnings: string[] = [];
  if (Math.abs(actual.calories - target.calories) > target.calories * 0.12)
    warnings.push(
      "Planned calories differ from your target by more than 12%. Review the portions.",
    );
  if (actual.protein < target.protein * 0.85)
    warnings.push(
      "Protein is below 85% of your target. Try a different meal or review your targets.",
    );
  if (actual.fiber < target.fiber * 0.8)
    warnings.push("Fiber is below your target. Consider a higher-fiber meal.");
  return warnings;
}
export function updateMealNutrition(
  meal: PlannedMeal,
  foods: CatalogFood[],
): PlannedMeal {
  return { ...meal, macros: mealMacros(meal.ingredients, foods) };
}
