import type { Macros } from "@/lib/nutrition/macros";
export type Profile = {
  id: string;
  first_name: string;
  units: "imperial" | "metric";
  timezone: string;
  starting_weight_kg: number;
  height_cm: number;
  age: number;
  onboarding_completed_at: string | null;
};
export type Targets = Macros & {
  water_ml: number;
  source: "recommended" | "manual";
};
export type DailyLog = {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  protein: boolean;
  fiber: boolean;
  rest_day: boolean;
  water_ml: number;
  local_date: string;
};
export type WeightEntry = { id: string; weight_kg: number; local_date: string };
export type Workout = {
  id: string;
  local_date: string;
  workout_type: string;
  duration_minutes: number | null;
  notes: string;
};
export type Meal = Macros & {
  id: string;
  local_date: string;
  slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  name: string;
  estimated_cost: number | null;
  ingredients: { food_id: string; name: string; quantity_g: number }[];
  status: "planned" | "completed" | "skipped";
};
export type ExtraFood = Macros & {
  id: string;
  name: string;
  cost: number | null;
};
export type Food = {
  id: string;
  name: string;
  natural_unit?: string | null;
  natural_unit_g?: number | null;
  piece_g?: number | null;
};
export type DashboardData = {
  profile: Profile;
  date: string;
  today: string;
  greeting: string;
  targets: Targets;
  goal: { goal: string; goal_weight_kg: number };
  workoutTarget: number;
  budget: number;
  log: DailyLog;
  weights: WeightEntry[];
  workouts: Workout[];
  weekLogs: DailyLog[];
  meals: Meal[];
  extras: ExtraFood[];
  foods: Food[];
  pantryAlerts: number;
};
