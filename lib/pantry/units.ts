import type { CatalogFood } from "@/lib/meal-plan/types";
export type FoodUnit = "g" | "kg" | "oz" | "lb" | "piece" | "serving";
const mass = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
export function unitGrams(
  unit: FoodUnit,
  food?: Pick<CatalogFood, "piece_g" | "serving_g">,
): number {
  if (unit in mass) return mass[unit as keyof typeof mass];
  const grams = unit === "piece" ? food?.piece_g : food?.serving_g;
  if (!grams || grams <= 0)
    throw new Error(
      `No reliable ${unit}-to-gram conversion is available. Use a weight unit.`,
    );
  return grams;
}
export function quantityToGrams(
  quantity: number,
  unit: FoodUnit,
  food?: Pick<CatalogFood, "piece_g" | "serving_g">,
) {
  if (!Number.isFinite(quantity) || quantity < 0)
    throw new Error("Enter a nonnegative quantity.");
  return Math.round(quantity * unitGrams(unit, food) * 1000) / 1000;
}
export function gramsToQuantity(
  grams: number,
  unit: FoodUnit,
  food?: Pick<CatalogFood, "piece_g" | "serving_g">,
) {
  return grams / unitGrams(unit, food);
}
export function formatGrams(grams: number) {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} kg`
    : `${grams.toLocaleString("en-US", { maximumFractionDigits: 1 })} g`;
}
export function foodUnits(
  food?: Pick<CatalogFood, "piece_g" | "serving_g">,
): FoodUnit[] {
  return [
    "g",
    "kg",
    "oz",
    "lb",
    ...(food?.piece_g ? ["piece" as const] : []),
    ...(food?.serving_g ? ["serving" as const] : []),
  ];
}
