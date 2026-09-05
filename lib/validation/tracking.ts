import { z } from "zod";
import { dateSchema } from "@/lib/date";
export const foodMacrosSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calories: z.coerce.number().min(0).max(4000),
  protein: z.coerce.number().min(0).max(300),
  carbs: z.coerce.number().min(0).max(600),
  fat: z.coerce.number().min(0).max(250),
  fiber: z.coerce.number().min(0).max(100),
});
export const extraFoodSchema = foodMacrosSchema.extend({
  date: dateSchema,
  cost: z.number().min(0).max(1000).nullable(),
});
export const mealSchema = foodMacrosSchema.extend({
  date: dateSchema,
  slot: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  estimated_cost: z.number().min(0).max(1000).nullable(),
  ingredients: z
    .array(
      z.object({
        food_id: z.string().uuid(),
        quantity_g: z.number().positive().max(100000),
      }),
    )
    .max(30),
});
export const workoutSchema = z.object({
  date: dateSchema,
  workout_type: z.enum([
    "Push",
    "Pull",
    "Legs",
    "Upper",
    "Lower",
    "Cardio",
    "Sports",
    "Full Body",
    "Other",
  ]),
  duration_minutes: z.number().int().min(1).max(600).nullable(),
  notes: z.string().trim().max(2000),
});
export const checkSchema = z.object({
  date: dateSchema,
  key: z.enum(["breakfast", "lunch", "dinner", "protein", "fiber", "rest_day"]),
  value: z.boolean(),
});
