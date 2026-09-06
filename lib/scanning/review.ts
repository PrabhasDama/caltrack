import { z } from "zod";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { RetailProduct } from "@/lib/pricing/types";
const nonnegative = z.number().nonnegative().finite();
export const labelReviewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  servingSize: z.number().positive().max(10000),
  servingUnit: z.string().trim().min(1).max(30),
  servingGrams: z.number().positive().max(10000),
  servingsPerContainer: z.number().positive().max(10000).nullable(),
  calories: nonnegative.max(10000),
  protein: nonnegative.max(1000),
  carbs: nonnegative.max(1000),
  fat: nonnegative.max(1000),
  fiber: nonnegative.max(1000),
  sugar: nonnegative.max(1000).nullable(),
  sodium: nonnegative.max(100000).nullable(),
  confirmed: z.literal(true),
});
export function normalizeReviewedLabel(input: unknown) {
  const d = labelReviewSchema.parse(input);
  const grams =
    d.servingUnit.toLowerCase() === "g"
      ? d.servingSize
      : d.servingUnit.toLowerCase() === "kg"
        ? d.servingSize * 1000
        : d.servingGrams;
  if (Math.abs(grams - d.servingGrams) > 0.001)
    throw new Error(
      "Serving weight must match the stated gram or kilogram serving.",
    );
  const values = {
    calories: (d.calories * 100) / grams,
    protein: (d.protein * 100) / grams,
    carbs: (d.carbs * 100) / grams,
    fat: (d.fat * 100) / grams,
    fiber: (d.fiber * 100) / grams,
    sugar: d.sugar === null ? null : (d.sugar * 100) / grams,
    sodium: d.sodium === null ? null : (d.sodium * 100) / grams,
  };
  if (
    values.calories > 1000 ||
    [
      values.protein,
      values.carbs,
      values.fat,
      values.fiber,
      values.sugar || 0,
    ].some((v) => v > 100)
  )
    throw new Error(
      "The serving weight and nutrients do not agree. Check the label before saving.",
    );
  return { ...d, per100g: values };
}
const clean = (name: string) =>
  name
    .toLowerCase()
    .replace(/\bchkn\b/g, "chicken")
    .replace(/\bbrst\b/g, "breast")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
export function matchReceiptName(
  name: string,
  foods: Pick<CatalogFood, "id" | "name" | "aliases">[],
  products: RetailProduct[],
  shoppingFoodIds: string[],
) {
  const words = clean(name);
  return foods
    .map((f) => {
      const choices = [f.name, ...f.aliases].map(clean);
      const overlap = Math.max(
        ...choices.map(
          (parts) =>
            parts.filter((w) => words.includes(w)).length /
            Math.max(1, parts.length),
        ),
      );
      const exact = choices.some(
        (parts) => parts.join(" ") === words.join(" "),
      );
      return {
        food: f,
        score: overlap + (exact ? 1 : 0),
        state: exact
          ? ("exact" as const)
          : overlap >= 0.5
            ? ("suggested" as const)
            : ("unmatched" as const),
        products: products.filter(
          (p) => p.food_id === f.id && p.is_active !== false,
        ),
        shopping: shoppingFoodIds.includes(f.id),
      };
    })
    .filter((r) => r.state !== "unmatched")
    .sort(
      (a, b) =>
        Number(b.shopping) - Number(a.shopping) ||
        b.score - a.score ||
        a.food.name.localeCompare(b.food.name),
    );
}
