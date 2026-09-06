import { z } from "zod";
import type { PlanDay, CatalogFood } from "@/lib/meal-plan/types";
import type { PantryRecord } from "@/lib/pantry/inventory";
export const prepTaskSchema = z.object({
  key: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        food_id: z.string().uuid(),
        quantity_g: z.number().positive(),
      }),
    )
    .optional(),
  food_id: z.string().uuid(),
  name: z.string(),
  quantity_g: z.number().positive(),
  meal_ids: z.array(z.string().uuid()),
  meals: z.array(z.string()),
  instruction: z.string(),
  minutes: z.number().int().nonnegative(),
  completed: z.boolean(),
});
export type PrepTask = z.infer<typeof prepTaskSchema>;
export type PrepSession = {
  id: string;
  local_date: string;
  start_date: string;
  end_date: string;
  tasks: PrepTask[];
  updated_at: string;
  source_revision: number;
};
// Only actual recipe steps produce work. Exact matching steps can share a batch;
// different cuts, methods or recipes remain separate rather than guessing compatibility.
const prepVerb =
  /\b(cook|simmer|boil|roast|bake|steam|brown|scramble|whisk|chop|dice|slice|wash|chill|refrigerate|microwave|saute|sauté|grill)\b/i;
const excluded =
  /^(olive oil|salt|spices|protein powder|greek yogurt|yogurt|bread|tortillas|peanut butter|milk|cheese|cottage cheese)$/i;
function mentions(step: string, food: CatalogFood) {
  const aliases: Record<string, string[]> = {
    "Chicken breast": ["chicken"],
    "Ground turkey": ["turkey"],
    "Ground beef": ["beef"],
    "Egg whites": ["whites"],
    "Mixed vegetables": ["vegetables"],
    "Bell peppers": ["peppers"],
    "Sweet potatoes": ["sweet potato"],
    "Green beans": ["green beans"],
  };
  return [food.name, ...(aliases[food.name] || [])].some((n) =>
    step.toLowerCase().includes(n.toLowerCase().replace(/s$/, "")),
  );
}
export function buildPrepTasks(
  days: PlanDay[],
  foods: CatalogFood[],
  start: string,
  end: string,
): PrepTask[] {
  const result = new Map<string, PrepTask>();
  for (const day of [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((d) => d.date >= start && d.date <= end)) {
    for (const meal of day.meals.filter(
      (m) => (!m.status || m.status === "planned") && m.log_id,
    )) {
      const assigned = new Set<string>();
      for (const step of meal.instructions || []) {
        if (
          !prepVerb.test(step) ||
          /just before serving|serve at once/i.test(step)
        )
          continue;
        const ingredients = meal.ingredients.filter((i) => {
          const f = foods.find((f) => f.id === i.food_id);
          return (
            f &&
            !excluded.test(f.name) &&
            !assigned.has(i.food_id) &&
            mentions(step, f)
          );
        });
        if (!ingredients.length) continue;
        // An ingredient participates once in a batch task; later dependent steps stay
        // together so chopping potatoes never hides their subsequent cooking step.
        const ids = new Set(ingredients.map((i) => i.food_id));
        const relatedSteps = (meal.instructions || []).filter(
          (t) =>
            t === step ||
            (prepVerb.test(t) &&
              ingredients.some((i) =>
                mentions(
                  t.split(/[.!?]/)[0],
                  foods.find((f) => f.id === i.food_id)!,
                ),
              )),
        );
        const instruction = relatedSteps.join(" ");
        const verb = /roast/i.test(step)
          ? "Roast"
          : /boil.*egg|egg.*boil/i.test(step)
            ? "Boil"
            : /steam/i.test(step)
              ? "Steam"
              : /cook|boil|simmer|bake|brown|microwave|scramble/i.test(step)
                ? "Cook"
                : /refrigerate|chill/i.test(step)
                  ? "Prepare"
                  : "Wash / chop";
        const key =
          [...ids].sort().join(":") +
          ":" +
          instruction.toLowerCase().replace(/\s+/g, " ");
        const old = result.get(key);
        if (old) {
          for (const i of ingredients) {
            const target = old.ingredients!.find(
              (x) => x.food_id === i.food_id,
            )!;
            target.quantity_g =
              Math.round((target.quantity_g + Number(i.quantity_g)) * 1000) /
              1000;
          }
          old.quantity_g = old.ingredients![0].quantity_g;
          old.meal_ids.push(meal.log_id!);
          old.meals.push(`${day.date} · ${meal.name}`);
        } else {
          const ranges = [
            ...instruction.matchAll(/(?:(\d+)[–-])?(\d+)\s*(?:minutes|min)\b/g),
          ].map((m) => Number(m[2]));
          result.set(key, {
            key,
            food_id: ingredients[0].food_id,
            ingredients: ingredients.map((i) => ({
              food_id: i.food_id,
              quantity_g: Number(i.quantity_g),
            })),
            quantity_g: Number(ingredients[0].quantity_g),
            name: `${verb} ${ingredients.map((i) => i.name.toLowerCase()).join(" & ")}`,
            instruction,
            minutes:
              ranges.length &&
              !/package (ratio|cooking time|instructions)/i.test(step)
                ? Math.max(...ranges)
                : Math.max(5, meal.cooking_minutes || 10),
            meal_ids: [meal.log_id!],
            meals: [`${day.date} · ${meal.name}`],
            completed: false,
          });
        }
        ingredients.forEach((i) => assigned.add(i.food_id));
      }
    }
  }
  return [...result.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.key!.localeCompare(b.key!),
  );
}
export function prepAvailability(
  task: PrepTask,
  pantry: PantryRecord[],
  date: string,
) {
  const stock = pantry
    .filter(
      (p) =>
        p.food_id === task.food_id && (!p.expires_on || p.expires_on >= date),
    )
    .reduce((s, p) => s + Number(p.quantity_g), 0);
  return {
    available: stock,
    missing: Math.max(0, Math.round((task.quantity_g - stock) * 1000) / 1000),
  };
}
