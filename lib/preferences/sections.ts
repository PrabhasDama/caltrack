import { z } from "zod";
import { isTimeZone } from "@/lib/date";
import { macrosSchema } from "@/lib/validation/onboarding";
const list = z.array(z.string().trim().min(1).max(80)).max(40);
export const sectionSchemas = {
  goals: z.object({
    goal: z.enum(["lose", "recomp", "maintain", "build"]),
    goal_weight_kg: z.number().min(25).max(500),
    pace: z.enum(["conservative", "moderate", "aggressive", "no_deadline"]),
  }),
  macros: macrosSchema.extend({
    water_ml: z.number().int().min(500).max(6000),
    source: z.literal("manual"),
    warnings_acknowledged_at: z.string().nullable(),
  }),
  budget: z.object({
    monthly_amount: z.number().min(20).max(10000).multipleOf(0.01),
    currency: z.enum(["USD", "CAD"]),
  }),
  cooking: z.object({
    cooking_minutes: z.union([
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(60),
    ]),
    complexity: z.number().int().min(1).max(3),
    meals_per_day: z.number().int().min(2).max(5),
    prep_frequency: z.enum(["daily", "twice_weekly", "weekly", "flexible"]),
    repeat_tolerance: z.enum(["repeat", "some", "variety"]),
  }),
  diet: z.object({ restrictions: list, excluded_foods: list }),
  foods: z.object({
    preferred_proteins: list,
    preferred_carbs: list,
    preferred_vegetables: list,
    preferred_fiber: list,
    disliked_foods: list,
  }),
  shopping: z.object({
    shopping_frequency: z.enum([
      "weekly",
      "twice_monthly",
      "monthly",
      "flexible",
    ]),
    shopping_preference: z.enum(["cheapest", "fewest", "balance", "closest"]),
    zip_code: z
      .string()
      .regex(/^\d{5}$/, "Use your saved five-digit ZIP code."),
  }),
  training: z.object({
    activity: z.enum(["sedentary", "light", "moderate", "very"]),
    workout_days: z.number().int().min(0).max(7),
    training_types: list,
  }),
  profile: z.object({
    first_name: z.string().trim().min(1).max(80),
    timezone: z.string().refine(isTimeZone),
    height_cm: z.number().min(100).max(250),
    age: z.number().int().min(18).max(100),
    sex: z.enum(["male", "female", "unspecified"]),
  }),
  units: z.object({
    country_code: z.enum(["US", "CA"]),
    display_units_override: z.enum(["metric", "imperial"]).nullable(),
  }),
  stores: z.object({ stores: z.array(z.string().uuid()).min(1).max(20) }),
};
export type Section = keyof typeof sectionSchemas;
export type Field = {
  key: string;
  label: string;
  type?: "number" | "list" | "select";
  options?: [string, string][];
  min?: number;
  max?: number;
  step?: string;
};
const choices = (s: string) =>
  s.split("|").map((v) => [v, v.replaceAll("_", " ")] as [string, string]);
export const sectionFields: Record<
  Section,
  { title: string; description: string; planning: boolean; fields: Field[] }
> = {
  cooking: {
    title: "Meals & cooking",
    description: "Cooking time, skill, meal count and repetition.",
    planning: true,
    fields: [
      {
        key: "cooking_minutes",
        label: "Cooking time",
        type: "select",
        options: [
          ["10", "Up to 10 minutes"],
          ["20", "Up to 20 minutes"],
          ["30", "Up to 30 minutes"],
          ["60", "Up to 60 minutes"],
        ],
      },
      {
        key: "complexity",
        label: "Cooking skill",
        type: "select",
        options: [
          ["1", "Beginner"],
          ["2", "Comfortable"],
          ["3", "Confident"],
        ],
      },
      {
        key: "meals_per_day",
        label: "Meals per day",
        type: "number",
        min: 2,
        max: 5,
      },
      {
        key: "prep_frequency",
        label: "Meal prep frequency",
        type: "select",
        options: choices("daily|twice_weekly|weekly|flexible"),
      },
      {
        key: "repeat_tolerance",
        label: "Repeat tolerance",
        type: "select",
        options: [
          ["repeat", "Happy to repeat"],
          ["some", "Some repetition"],
          ["variety", "Prefer variety"],
        ],
      },
    ],
  },
  diet: {
    title: "Dietary restrictions",
    description:
      "Strict exclusions apply to new recommendations. Existing saved meals stay unchanged.",
    planning: true,
    fields: [
      { key: "restrictions", label: "Dietary restrictions", type: "list" },
      { key: "excluded_foods", label: "Ingredients to exclude", type: "list" },
    ],
  },
  foods: {
    title: "Food preferences",
    description:
      "Use comma-separated food names. Disliked foods are excluded from new recommendations.",
    planning: true,
    fields: [
      { key: "preferred_proteins", label: "Preferred proteins", type: "list" },
      {
        key: "preferred_carbs",
        label: "Preferred carbohydrates",
        type: "list",
      },
      {
        key: "preferred_vegetables",
        label: "Preferred vegetables",
        type: "list",
      },
      { key: "preferred_fiber", label: "Preferred fiber foods", type: "list" },
      { key: "disliked_foods", label: "Disliked foods", type: "list" },
    ],
  },
  goals: {
    title: "Goals",
    description:
      "Changing your goal does not silently replace your macro targets.",
    planning: true,
    fields: [
      {
        key: "goal",
        label: "Goal",
        type: "select",
        options: choices("lose|recomp|maintain|build"),
      },
      {
        key: "goal_weight_kg",
        label: "Goal weight",
        type: "number",
        min: 25,
        max: 500,
        step: "any",
      },
      {
        key: "pace",
        label: "Pace",
        type: "select",
        options: choices("conservative|moderate|aggressive|no_deadline"),
      },
    ],
  },
  macros: {
    title: "Macro targets",
    description:
      "Edit your daily targets directly. Saved meals are not recalculated until you regenerate.",
    planning: true,
    fields: [
      {
        key: "calories",
        label: "Calories (kcal)",
        type: "number",
        min: 1200,
        max: 8000,
      },
      {
        key: "protein",
        label: "Protein (g)",
        type: "number",
        min: 20,
        max: 500,
      },
      { key: "carbs", label: "Carbs (g)", type: "number", min: 0, max: 1200 },
      { key: "fat", label: "Fat (g)", type: "number", min: 10, max: 400 },
      { key: "fiber", label: "Fiber (g)", type: "number", min: 0, max: 100 },
      {
        key: "water_ml",
        label: "Daily water target (mL)",
        type: "number",
        min: 500,
        max: 6000,
      },
    ],
  },
  budget: {
    title: "Grocery budget",
    description:
      "An ongoing monthly target. Currency changes do not convert prior purchases.",
    planning: true,
    fields: [
      {
        key: "monthly_amount",
        label: "Monthly grocery budget",
        type: "number",
        min: 20,
        max: 10000,
        step: ".01",
      },
      {
        key: "currency",
        label: "Budget currency",
        type: "select",
        options: choices("USD|CAD"),
      },
    ],
  },
  stores: {
    title: "Preferred stores",
    description:
      "Your preferred chains. Demo locations do not imply live price support.",
    planning: false,
    fields: [],
  },
  shopping: {
    title: "Shopping preferences",
    description: "Your shopping rhythm and future store-selection preference.",
    planning: false,
    fields: [
      {
        key: "shopping_frequency",
        label: "Shopping frequency",
        type: "select",
        options: choices("weekly|twice_monthly|monthly|flexible"),
      },
      {
        key: "shopping_preference",
        label: "Shopping priority",
        type: "select",
        options: choices("cheapest|fewest|balance|closest"),
      },
      { key: "zip_code", label: "Saved US ZIP code" },
    ],
  },
  units: {
    title: "Country & measurement",
    description:
      "US defaults to customary; Canada defaults to metric. Natural item counts work in both.",
    planning: false,
    fields: [
      {
        key: "country_code",
        label: "Country",
        type: "select",
        options: [
          ["US", "United States"],
          ["CA", "Canada"],
        ],
      },
      {
        key: "display_units_override",
        label: "Measurement system",
        type: "select",
        options: [
          ["", "Country default"],
          ["imperial", "US customary"],
          ["metric", "Metric"],
        ],
      },
    ],
  },
  training: {
    title: "Activity & training",
    description: "Update your routine without resubmitting nutrition settings.",
    planning: false,
    fields: [
      {
        key: "activity",
        label: "Activity level",
        type: "select",
        options: choices("sedentary|light|moderate|very"),
      },
      {
        key: "workout_days",
        label: "Workout days per week",
        type: "number",
        min: 0,
        max: 7,
      },
      { key: "training_types", label: "Training types", type: "list" },
    ],
  },
  profile: {
    title: "Personal details",
    description: "Your name, time zone and profile measurements.",
    planning: false,
    fields: [
      { key: "first_name", label: "First name" },
      { key: "timezone", label: "Time zone" },
      {
        key: "height_cm",
        label: "Height (cm)",
        type: "number",
        min: 100,
        max: 250,
        step: "any",
      },
      { key: "age", label: "Age", type: "number", min: 18, max: 100 },
      {
        key: "sex",
        label: "Equation input",
        type: "select",
        options: choices("unspecified|female|male"),
      },
    ],
  },
};
