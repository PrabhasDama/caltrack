import { z } from "zod";
import type { PlanDay, CatalogFood } from "@/lib/meal-plan/types";
import type { PantryRecord } from "@/lib/pantry/inventory";
export const prepTaskSchema = z.object({
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
function taskFor(food: CatalogFood) {
  if (["Rice", "Pasta", "Quinoa", "Oats"].includes(food.name))
    return {
      instruction: `Measure the dry ${food.name.toLowerCase()}. Cook according to the related recipes, then divide into their listed portions.`,
      minutes: 20,
    };
  if (
    food.preparation.toLowerCase().includes("raw") &&
    food.category === "protein"
  )
    return {
      instruction: `Prepare ${food.name.toLowerCase()} using the cooking method and temperature in each related recipe. Keep different preparations separate.`,
      minutes: 25,
    };
  if (
    food.category === "vegetable" ||
    [
      "Broccoli",
      "Spinach",
      "Carrots",
      "Bell peppers",
      "Potatoes",
      "Mixed vegetables",
      "Green beans",
    ].includes(food.name)
  )
    return {
      instruction: `Wash and prepare ${food.name.toLowerCase()} for the related recipes. Keep portions together only when the preparation matches.`,
      minutes: 10,
    };
  return {
    instruction: `Measure and portion ${food.name.toLowerCase()} in its reference form: ${food.preparation}. Follow each meal's recipe.`,
    minutes: 5,
  };
}
export function buildPrepTasks(
  days: PlanDay[],
  foods: CatalogFood[],
  start: string,
  end: string,
): PrepTask[] {
  const result = new Map<string, PrepTask>();
  for (const day of days.filter((d) => d.date >= start && d.date <= end))
    for (const meal of day.meals.filter(
      (m) => (!m.status || m.status === "planned") && m.log_id,
    ))
      for (const i of meal.ingredients) {
        const food = foods.find((f) => f.id === i.food_id);
        if (!food) continue;
        const old = result.get(i.food_id) || {
          food_id: i.food_id,
          name: food.name,
          quantity_g: 0,
          meal_ids: [],
          meals: [],
          ...taskFor(food),
          completed: false,
        };
        old.quantity_g =
          Math.round((old.quantity_g + Number(i.quantity_g)) * 1000) / 1000;
        old.meal_ids.push(meal.log_id!);
        old.meals.push(`${day.date} · ${meal.name}`);
        result.set(i.food_id, old);
      }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
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
