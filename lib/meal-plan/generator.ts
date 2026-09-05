import { addDays } from "@/lib/date";
import { sumMacros, type Macros } from "@/lib/nutrition/macros";
import { allowedTemplates, matchesFood } from "./restrictions";
import { mealMacros, dayMacros, round } from "./calculations";
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
): PlannedMeal {
  const base = mealMacros(template.items, foods);
  const factor = Math.max(
    0.5,
    Math.min(3, calories / Math.max(1, base.calories)),
  );
  const ingredients = template.items.map((i) => ({
    food_id: i.food_id,
    name: foods.find((f) => f.id === i.food_id)!.name,
    quantity_g: Math.max(1, round(i.quantity_g * factor, 0)),
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
function loss(actual: Macros, target: Macros) {
  return (
    4 * ((actual.calories - target.calories) / target.calories) ** 2 +
    3 *
      ((actual.protein - target.protein) / Math.max(20, target.protein)) ** 2 +
    0.5 * ((actual.carbs - target.carbs) / Math.max(40, target.carbs)) ** 2 +
    0.8 * ((actual.fat - target.fat) / Math.max(20, target.fat)) ** 2 +
    2 *
      (Math.min(0, actual.fiber - target.fiber) / Math.max(10, target.fiber)) **
        2
  );
}
export function fitDay(
  day: PlanDay,
  context: Pick<PlanContext, "foods" | "templates" | "targets">,
): PlanDay {
  const meals = structuredClone(day.meals);
  let totals = sumMacros(meals.map((m) => m.macros));
  // Bounded coordinate descent over practical template portions; deterministic, no solver.
  for (let pass = 0; pass < 100; pass++) {
    let best = loss(totals, context.targets);
    let choice:
      | { m: number; i: number; grams: number; macros: Macros; total: Macros }
      | undefined;
    for (let mi = 0; mi < meals.length; mi++) {
      const meal = meals[mi];
      if (meal.status && meal.status !== "planned") continue;
      const template = context.templates.find(
        (t) => t.id === meal.template_id,
      )!;
      for (let ii = 0; ii < meal.ingredients.length; ii++) {
        const ingredient = meal.ingredients[ii];
        const base = template.items.find(
          (i) => i.food_id === ingredient.food_id,
        )!.quantity_g;
        for (const change of [-1, 1]) {
          const grams = round(
            ingredient.quantity_g + change * Math.max(2, round(base * 0.08, 0)),
            0,
          );
          if (grams < Math.max(1, base * 0.5) || grams > base * 3) continue;
          const items = meal.ingredients.map((it, i) =>
            i === ii ? { ...it, quantity_g: grams } : it,
          );
          const macros = mealMacros(items, context.foods);
          const total = { ...totals };
          for (const k of Object.keys(total) as (keyof Macros)[])
            total[k] += macros[k] - meal.macros[k];
          const score = loss(total, context.targets);
          if (score < best - 1e-7) {
            best = score;
            choice = { m: mi, i: ii, grams, macros, total };
          }
        }
      }
    }
    if (!choice) break;
    meals[choice.m].ingredients[choice.i].quantity_g = choice.grams;
    meals[choice.m].macros = choice.macros;
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
      const top = candidates.filter((t) => !used.has(t.id));
      const pool = top.length ? top : candidates;
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
  );
  return {
    ...day,
    meals: day.meals.map((m, i) => (i === index ? candidate : m)),
  };
}
export function plannedTotals(days: PlanDay[]) {
  return days.map((d) => ({ date: d.date, ...dayMacros(d) }));
}
