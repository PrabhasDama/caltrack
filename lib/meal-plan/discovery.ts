import type { PlanContext, PlannedMeal } from "./types";
import { allowedTemplates } from "./restrictions";
import { scaleTemplate, targetLoss } from "./generator";
import { compareCarts, smartSwapDelta } from "@/lib/optimization/engine";
import { addDays } from "@/lib/date";
export type FoodCost = {
  package_g: number;
  price: number;
  currency: "USD" | "CAD";
  is_demo: boolean;
  observed_at: string;
};
export function estimateMeal(
  meal: PlannedMeal,
  context: PlanContext,
  pantry = false,
) {
  let cost = 0,
    known = true,
    total = 0,
    covered = 0,
    expiring = 0,
    isDemo = false;
  const missing: { food_id: string; name: string; grams: number }[] = [];
  for (const i of meal.ingredients) {
    const stock = context.pantry?.find((p) => p.food_id === i.food_id);
    const usable =
      stock && (!stock.expires_on || stock.expires_on >= context.today)
        ? stock.quantity_g
        : 0;
    const used = pantry ? Math.min(usable, i.quantity_g) : 0;
    total += i.quantity_g;
    covered += used;
    if (
      stock?.expires_on &&
      stock.expires_on >= context.today &&
      stock.expires_on <= addDays(context.today, 3)
    )
      expiring += used;
    const need = Math.max(0, i.quantity_g - used);
    if (need > 0) {
      missing.push({ food_id: i.food_id, name: i.name, grams: need });
      const price = context.foodCosts?.[i.food_id];
      if (!price) known = false;
      else {
        isDemo ||= price.is_demo;
        cost += pantry
          ? Math.ceil(need / price.package_g) * price.price
          : (need / price.package_g) * price.price;
      }
    }
  }
  if (pantry && context.optimization) {
    const cart = compareCarts(
      missing,
      context.optimization,
      context.preferences.currency,
    ).bestSplit;
    known = cart.total !== null;
    cost = cart.subtotal;
    isDemo = cart.lines.some((l) =>
      l.packages.some((p) => p.offer.source === "demo"),
    );
  }
  return {
    coverage: total ? covered / total : 0,
    expiringCoverage: total ? expiring / total : 0,
    missing,
    cost: known ? Math.round(cost * 100) / 100 : null,
    isDemo,
    currency: context.preferences.currency,
  };
}
export type SwapMode =
  | "Recommended"
  | "Higher Protein"
  | "Lower Calorie"
  | "Cheaper"
  | "Quick Prep"
  | "Browse All";
export function rankSwaps(
  context: PlanContext,
  current: PlannedMeal,
  mode: SwapMode,
  search = "",
) {
  const originalCost = estimateMeal(current, context).cost;
  let candidates = allowedTemplates(
    context.templates,
    context.foods,
    context.preferences,
  )
    .filter(
      (t) =>
        t.id !== current.template_id &&
        t.slots.includes(current.slot) &&
        (t.name + " " + (t.recipe?.cuisine || ""))
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .map((template) => {
      const meal = scaleTemplate(
        template,
        context.foods,
        current.macros.calories,
        current.slot,
        current.key,
        context.units,
      );
      const smart = context.optimization
        ? smartSwapDelta(current, meal, context.days, context)
        : null;
      return {
        template,
        meal,
        estimate: estimateMeal(meal, context),
        smart,
        pantry: estimateMeal(meal, context, true),
      };
    });
  if (mode === "Higher Protein")
    candidates = candidates.filter(
      (c) => c.meal.macros.protein > current.macros.protein,
    );
  if (mode === "Lower Calorie")
    candidates = candidates.filter(
      (c) => c.meal.macros.calories < current.macros.calories,
    );
  if (mode === "Cheaper")
    candidates = candidates.filter((c) =>
      context.optimization
        ? c.smart?.weekSavings !== null && (c.smart?.weekSavings || 0) > 0
        : originalCost !== null &&
          c.estimate.cost !== null &&
          c.estimate.cost < originalCost,
    );
  return candidates.sort((a, b) => {
    const delta =
      mode === "Higher Protein"
        ? b.meal.macros.protein - a.meal.macros.protein
        : mode === "Lower Calorie"
          ? a.meal.macros.calories - b.meal.macros.calories
          : mode === "Quick Prep"
            ? a.meal.cooking_minutes - b.meal.cooking_minutes
            : mode === "Cheaper"
              ? context.optimization
                ? (b.smart?.weekSavings ?? -Infinity) -
                  (a.smart?.weekSavings ?? -Infinity)
                : (a.estimate.cost ?? Infinity) - (b.estimate.cost ?? Infinity)
              : mode === "Browse All"
                ? a.template.name.localeCompare(b.template.name)
                : targetLoss(a.meal.macros, current.macros) * 3 -
                  a.pantry.coverage -
                  (a.smart?.weekSavings || 0) / 10 -
                  (targetLoss(b.meal.macros, current.macros) * 3 -
                    b.pantry.coverage -
                    (b.smart?.weekSavings || 0) / 10);
    return delta || a.template.slug.localeCompare(b.template.slug);
  });
}
export type PantryMode =
  | "Use Pantry First"
  | "Lowest Extra Spend"
  | "Best Macro Fit"
  | "Use Expiring Ingredients";
export function rankPantryMeals(
  context: PlanContext,
  slot: PlannedMeal["slot"],
  mode: PantryMode,
) {
  const target = { ...context.targets };
  for (const k of Object.keys(target) as (keyof typeof target)[])
    target[k] /= context.preferences.mealsPerDay;
  const candidates = allowedTemplates(
    context.templates,
    context.foods,
    context.preferences,
  )
    .filter((t) => t.slots.includes(slot))
    .map((template) => {
      const meal = scaleTemplate(
        template,
        context.foods,
        target.calories,
        slot,
        "pantry",
        context.units,
      );
      return {
        template,
        meal,
        estimate: estimateMeal(meal, context, true),
        fit: targetLoss(meal.macros, target),
      };
    });
  return candidates.sort((a, b) => {
    const delta =
      mode === "Lowest Extra Spend"
        ? (a.estimate.cost ?? Infinity) - (b.estimate.cost ?? Infinity)
        : mode === "Best Macro Fit"
          ? a.fit - b.fit
          : mode === "Use Expiring Ingredients"
            ? b.estimate.expiringCoverage - a.estimate.expiringCoverage
            : b.estimate.coverage - a.estimate.coverage;
    return (
      delta ||
      a.estimate.missing.length - b.estimate.missing.length ||
      a.fit - b.fit ||
      (context.recentTemplateIds?.filter((id) => id === a.template.id).length ||
        0) -
        (context.recentTemplateIds?.filter((id) => id === b.template.id)
          .length || 0) ||
      a.meal.cooking_minutes - b.meal.cooking_minutes ||
      a.template.slug.localeCompare(b.template.slug)
    );
  });
}
