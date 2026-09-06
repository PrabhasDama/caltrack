import { addDays } from "@/lib/date";
import { normalizePortion, type Measurement } from "@/lib/food/quantities";
import { sumMacros, type Macros } from "@/lib/nutrition/macros";
import { allowedTemplates, matchesFood } from "./restrictions";
import { mealMacros, dayMacros } from "./calculations";
import type {
  CatalogFood,
  MealTemplate,
  PlanContext,
  PlanDay,
  PlannedMeal,
} from "./types";
const slotSets: Record<number, PlannedMeal["slot"][]> = {
  2: ["Lunch", "Dinner"],
  3: ["Breakfast", "Lunch", "Dinner"],
  4: ["Breakfast", "Lunch", "Dinner", "Snack"],
  5: ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"],
};
export function scaleTemplate(
  template: MealTemplate,
  foods: CatalogFood[],
  calories: number,
  slot: PlannedMeal["slot"],
  key: string,
  units: Measurement = "metric",
): PlannedMeal {
  const base = mealMacros(template.items, foods);
  const factor = Math.max(
    0.5,
    Math.min(2, calories / Math.max(1, base.calories)),
  );
  const ingredients = template.items.map((i) => ({
    food_id: i.food_id,
    name: foods.find((f) => f.id === i.food_id)!.name,
    quantity_g: normalizePortion(
      i.quantity_g * factor,
      foods.find((f) => f.id === i.food_id)!,
      i.quantity_g * 0.5,
      i.quantity_g * 3,
      units,
    ),
  }));
  return {
    key,
    template_id: template.id,
    name: template.name,
    slot,
    ingredients,
    macros: mealMacros(ingredients, foods),
    instructions: template.instructions,
    cooking_minutes: template.cooking_minutes,
  };
}
export const targetTolerances: Record<keyof Macros, number> = {
  calories: 0.1,
  protein: 0.15,
  carbs: 0.2,
  fat: 0.25,
  fiber: 0.2,
};
export function targetLoss(
  actual: Macros,
  target: Macros,
  tolerances = targetTolerances,
) {
  const weights = { calories: 4, protein: 3, carbs: 0.5, fat: 0.8, fiber: 2 };
  return (Object.keys(weights) as (keyof Macros)[]).reduce((sum, k) => {
    const difference =
      k === "fiber"
        ? Math.max(0, target[k] - actual[k])
        : Math.abs(actual[k] - target[k]);
    const excess = Math.max(
      0,
      difference / Math.max(1, target[k]) - tolerances[k],
    );
    return sum + weights[k] * excess ** 2;
  }, 0);
}
export function fitDay(
  day: PlanDay,
  context: Pick<PlanContext, "foods" | "templates" | "targets" | "units">,
): PlanDay {
  const meals = structuredClone(day.meals);
  let totals = sumMacros(meals.map((m) => m.macros));
  // Scale coherent recipes as a whole. Never independently inflate one ingredient to chase a macro.
  for (let pass = 0; pass < 20; pass++) {
    let best = targetLoss(totals, context.targets);
    let choice: { index: number; meal: PlannedMeal; total: Macros } | null =
      null;
    for (let i = 0; i < meals.length; i++) {
      const current = meals[i];
      if (current.status && current.status !== "planned") continue;
      const template = context.templates.find(
        (t) => t.id === current.template_id,
      )!;
      for (const change of [-0.125, 0.125]) {
        const base = mealMacros(template.items, context.foods).calories;
        const candidate = scaleTemplate(
          template,
          context.foods,
          current.macros.calories + base * change,
          current.slot,
          current.key,
          context.units,
        );
        const total = sumMacros(
          meals.map((m, j) => (j === i ? candidate.macros : m.macros)),
        );
        const score = targetLoss(total, context.targets);
        if (score < best - 1e-7) {
          best = score;
          choice = { index: i, meal: candidate, total };
        }
      }
    }
    if (!choice) break;
    meals[choice.index] = choice.meal;
    totals = choice.total;
  }
  return { ...day, meals };
}
export function generatePlan(
  context: PlanContext,
  start: string,
  count: number,
  variation = 0,
): PlanDay[] {
  const allowed = allowedTemplates(
    context.templates,
    context.foods,
    context.preferences,
  );
  const slots = slotSets[context.preferences.mealsPerDay];
  if (!slots) throw new Error("Choose between two and five meals per day.");
  const days: PlanDay[] = [];
  for (let d = 0; d < count; d++) {
    const date = addDays(start, d);
    const used = new Set<string>();
    const meals = slots.map((slot, index) => {
      const candidates = allowed.filter((t) => t.slots.includes(slot));
      if (!candidates.length)
        throw new Error(
          `No ${slot.toLowerCase()} template fits your food and cooking preferences. Review your preferences; exclusions will never be ignored.`,
        );
      candidates.sort((a, b) => {
        const score = (t: MealTemplate) =>
          t.items.filter((i) =>
            context.preferences.preferred.some((p) =>
              matchesFood(
                context.foods.find((f) => f.id === i.food_id)!,
                p,
              ),
            ),
          ).length +
          (context.preferences.prepFrequency !== "daily" && t.batch_friendly
            ? 1
            : 0) +
          (context.preferences.monthlyBudget < 200 &&
          t.items.every(
            (i) =>
              context.foods.find((f) => f.id === i.food_id)?.category !==
              "premium-protein",
          )
            ? 1
            : 0);
        return score(b) - score(a) || a.slug.localeCompare(b.slug);
      });
      const rotation =
        context.preferences.repeatTolerance === "repeat"
          ? 0
          : context.preferences.repeatTolerance === "some"
            ? Math.floor(d / 2)
            : d;
      const old = context.days.find((day) => day.date === date)?.meals[index]
        ?.template_id;
      const alternatives = candidates.filter((t) => t.id !== old);
      const choices = alternatives.length ? alternatives : candidates;
      const top = choices.filter((t) => !used.has(t.id));
      let pool = top.length ? top : choices;
      if (context.preferences.repeatTolerance === "variety") {
        const counts = new Map<string, number>();
        for (const day of days)
          for (const m of day.meals)
            counts.set(m.template_id, (counts.get(m.template_id) || 0) + 1);
        const least = Math.min(...pool.map((t) => counts.get(t.id) || 0));
        pool = pool.filter((t) => (counts.get(t.id) || 0) === least);
      }
      const template = pool[(rotation + variation + index) % pool.length];
      used.add(template.id);
      const weights = slots.map((s) => (s === "Snack" ? 0.55 : 1));
      const kcal =
        (context.targets.calories * weights[index]) /
        weights.reduce((a, b) => a + b, 0);
      return scaleTemplate(
        template,
        context.foods,
        kcal,
        slot,
        `${date}-${index}`,
        context.units,
      );
    });
    days.push(fitDay({ date, meals }, context));
  }
  return days;
}
export function swapMeal(
  day: PlanDay,
  index: number,
  template: MealTemplate,
  context: PlanContext,
) {
  const original = day.meals[index];
  if (original.status && original.status !== "planned")
    throw new Error("Only uneaten, unskipped meals can be replaced.");
  const candidate = scaleTemplate(
    template,
    context.foods,
    original.macros.calories,
    original.slot,
    original.key,
    context.units,
  );
  return {
    ...day,
    meals: day.meals.map((m, i) => (i === index ? candidate : m)),
  };
}
export function plannedTotals(days: PlanDay[]) {
  return days.map((d) => ({ date: d.date, ...dayMacros(d) }));
}
