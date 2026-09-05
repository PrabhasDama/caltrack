import type { Macros } from "@/lib/nutrition/macros";
export type CatalogFood = {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  tags: string[];
  preparation: string;
  serving_g: number;
  piece_g: number | null;
  nutrition: Macros;
  source: string;
};
export type TemplateItem = {
  food_id: string;
  quantity_g: number;
  role: "protein" | "carb" | "fat" | "fiber";
};
export type MealTemplate = {
  id: string;
  slug: string;
  name: string;
  slots: string[];
  instructions: string[];
  cooking_minutes: number;
  complexity: number;
  batch_friendly: boolean;
  items: TemplateItem[];
};
export type PlannedMeal = {
  key: string;
  template_id: string;
  name: string;
  slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  ingredients: { food_id: string; name: string; quantity_g: number }[];
  macros: Macros;
  instructions: string[];
  cooking_minutes: number;
  log_id?: string;
  status?: "planned" | "completed" | "skipped";
};
export type PlanDay = { date: string; meals: PlannedMeal[] };
export type PlanPreferences = {
  mealsPerDay: number;
  restrictions: string[];
  excluded: string[];
  disliked: string[];
  preferred: string[];
  cookingMinutes: number;
  complexity: number;
  prepFrequency: string;
  repeatTolerance: string;
  monthlyBudget: number;
  currency: "USD" | "CAD";
};
export type PlanContext = {
  foods: CatalogFood[];
  templates: MealTemplate[];
  targets: Macros;
  preferences: PlanPreferences;
  today: string;
  days: PlanDay[];
  revision: number;
};
