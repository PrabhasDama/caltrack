import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import type { CatalogFood, MealTemplate } from "@/lib/meal-plan/types";
const nutrition = z.object({
  calories: z.coerce.number(),
  protein: z.coerce.number(),
  carbs: z.coerce.number(),
  fat: z.coerce.number(),
  fiber: z.coerce.number(),
  serving_g: z.coerce.number(),
  piece_g: z.coerce.number().nullable(),
  source: z.string(),
});
const foodRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  preparation: z.string(),
  portion_step_g: z.coerce.number().optional(),
  natural_unit: z.string().nullable().optional(),
  natural_unit_g: z.coerce.number().nullable().optional(),
  food_nutrition: nutrition.nullable(),
});
const templateRow = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  slots: z.array(z.string()),
  instructions: z.array(z.string()),
  cooking_minutes: z.number(),
  complexity: z.number(),
  batch_friendly: z.boolean(),
  recipe: z
    .object({
      prep_minutes: z.number(),
      cook_minutes: z.number(),
      servings: z.number(),
      notes: z.string(),
      seasonings: z.array(z.string()),
      cuisine: z.string(),
      price_tier: z.number(),
    })
    .optional(),
  meal_items: z.array(
    z.object({
      food_id: z.string(),
      quantity_g: z.coerce.number(),
      role: z.enum(["protein", "carb", "fat", "fiber"]),
    }),
  ),
});
export const getCatalog = cache(async function getCatalog(
  client: Awaited<ReturnType<typeof createClient>>,
): Promise<{ foods: CatalogFood[]; templates: MealTemplate[] }> {
  const [f, m] = await Promise.all([
    client.from("foods").select("*,food_nutrition(*)").order("name"),
    client
      .from("meals")
      .select("*,meal_items(food_id,quantity_g,role)")
      .order("slug"),
  ]);
  if (f.error || m.error)
    throw new Error("The food reference library could not be loaded.");
  const foods = foodRow
    .array()
    .parse(f.data)
    .filter((f) => f.food_nutrition !== null)
    .map((f) => {
      const n = f.food_nutrition!;
      return {
        id: f.id,
        name: f.name,
        category: f.category,
        aliases: f.aliases,
        tags: f.tags,
        preparation: f.preparation,
        portion_step_g: f.portion_step_g,
        natural_unit: f.natural_unit,
        natural_unit_g: f.natural_unit_g,
        serving_g: n.serving_g,
        piece_g: n.piece_g,
        source: n.source,
        nutrition: {
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          fat: n.fat,
          fiber: n.fiber,
        },
      };
    });
  const templates = templateRow
    .array()
    .parse(m.data)
    .map(({ meal_items, ...t }) => ({ ...t, items: meal_items }));
  return { foods, templates };
});
