import type { CatalogFood } from "@/lib/meal-plan/types";
export type Measurement = "imperial" | "metric";
export function measurementFor(
  country: "US" | "CA",
  override?: Measurement | null,
): Measurement {
  return override || (country === "CA" ? "metric" : "imperial");
}
export const weightGrams = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
export const volumeMl = {
  mL: 1,
  L: 1000,
  "fl oz": 29.5735295625,
  cup: 236.5882365,
  tbsp: 14.78676478125,
  tsp: 4.92892159375,
};
export function volumeToGrams(
  amount: number,
  unit: keyof typeof volumeMl,
  gramsPerMl: number | null,
) {
  if (!gramsPerMl || gramsPerMl <= 0 || !Number.isFinite(amount) || amount < 0)
    throw new Error("A known food density is required");
  return amount * volumeMl[unit] * gramsPerMl;
}
export function portionStep(food: CatalogFood, units: Measurement = "metric") {
  if (food.natural_unit_g || food.piece_g)
    return food.natural_unit_g || food.piece_g!;
  if (food.name === "Olive oil") return 4.5;
  if (
    units === "imperial" &&
    !["fat", "carb"].includes(food.category) &&
    food.name !== "Chia seeds"
  )
    return weightGrams.oz;
  return (
    food.portion_step_g ||
    (food.category === "fat"
      ? 5
      : ["Rice", "Oats", "Pasta", "Quinoa"].includes(food.name)
        ? 10
        : food.name === "Chia seeds"
          ? 5
          : 25)
  );
}
export function normalizePortion(
  grams: number,
  food: CatalogFood,
  min = 0,
  max = 1000000,
  units: Measurement = "metric",
) {
  const step = portionStep(food, units);
  const low = Math.max(1, Math.ceil((min - 0.00001) / step));
  const high = Math.floor((max + 0.00001) / step);
  if (high < low) throw new Error(`No practical portion fits ${food.name}`);
  return (
    Math.round(
      Math.max(low, Math.min(high, Math.round(grams / step))) * step * 1000,
    ) / 1000
  );
}
type QuantityFood = Pick<
  CatalogFood,
  "name" | "natural_unit" | "natural_unit_g"
> & { piece_g?: number | null };
const label = (food: QuantityFood, count: number) => {
  const singular =
    food.natural_unit ||
    (
      {
        Eggs: "egg",
        Bananas: "banana",
        Apples: "apple",
        Bread: "slice",
        Tortillas: "tortilla",
      } as Record<string, string>
    )[food.name] ||
    "piece";
  return count === 1
    ? singular
    : singular === "slice"
      ? "slices"
      : `${singular}s`;
};
const n = (value: number, digits = 1) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });
export function formatWeight(grams: number, units: Measurement = "metric") {
  if (units === "imperial")
    return grams >= weightGrams.lb
      ? `${n(grams / weightGrams.lb, 2)} lb`
      : `${n(grams / weightGrams.oz, 2)} oz`;
  return grams >= 1000 ? `${n(grams / 1000, 3)} kg` : `${n(grams, 1)} g`;
}
export function formatFoodQuantity(
  grams: number,
  food: QuantityFood | undefined,
  units: Measurement = "metric",
  shopping = false,
) {
  if (!food) return formatWeight(grams, units);
  const piece = food.natural_unit_g || food.piece_g;
  if (piece) {
    const count = grams / piece;
    const whole = shopping ? Math.ceil(count - 0.00001) : Math.round(count);
    if (shopping || Math.abs(count - whole) < 0.0001)
      return `${whole} ${label(food, whole)}`;
    return `${formatWeight(grams, units)} (about ${whole} ${label(food, whole)})`;
  }
  if (food.name === "Olive oil") {
    if (units === "imperial") {
      const tsp = grams / 4.5;
      return `${n(tsp / 3, 2)} tbsp (about ${n(tsp, 1)} tsp; ${n(grams, 1)} g)`;
    }
    return `${n(grams / 0.91, 1)} mL (about ${n(grams, 1)} g)`;
  }
  return formatWeight(grams, units);
}
