import type { CatalogFood, MealTemplate, PlanPreferences } from "./types";
export function normalizeFoodName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w.endsWith("ies")
        ? w.slice(0, -3) + "y"
        : w.endsWith("s")
          ? w.slice(0, -1)
          : w,
    )
    .join(" ");
}
export function matchesFood(food: CatalogFood, term: string) {
  const needle = normalizeFoodName(term);
  return (
    Boolean(needle) &&
    [food.name, ...food.aliases].some(
      (name) =>
        normalizeFoodName(name).includes(needle) ||
        needle.includes(normalizeFoodName(name)),
    )
  );
}
export function allowedFood(food: CatalogFood, prefs: PlanPreferences) {
  if (
    [...prefs.excluded, ...prefs.disliked].some((term) =>
      matchesFood(food, term),
    )
  )
    return false;
  for (const restriction of prefs.restrictions.map((v) => v.toLowerCase())) {
    if (
      ["vegan", "halal", "kosher"].includes(restriction) &&
      !food.tags.includes("vegan")
    )
      return false;
    if (restriction === "vegetarian" && food.tags.includes("meat"))
      return false;
    if (restriction === "vegetarian" && food.tags.includes("fish"))
      return false;
    if (restriction === "lactose-free" && food.tags.includes("dairy"))
      return false;
    if (restriction === "gluten-free" && food.tags.includes("gluten"))
      return false;
  }
  return true;
}
export function allowedTemplates(
  templates: MealTemplate[],
  foods: CatalogFood[],
  prefs: PlanPreferences,
) {
  return templates.filter(
    (t) =>
      t.cooking_minutes <= prefs.cookingMinutes &&
      t.complexity <= prefs.complexity &&
      t.items.length > 0 &&
      t.items.every((item) => {
        const food = foods.find((f) => f.id === item.food_id);
        return food && allowedFood(food, prefs);
      }),
  );
}
