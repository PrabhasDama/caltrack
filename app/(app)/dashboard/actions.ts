"use server";
import { z } from "zod";
import { invalidate } from "@/lib/services/invalidation";
import { requireProfile } from "@/lib/services/auth";
import { dateSchema, localDate, addDays } from "@/lib/date";
import { toKg } from "@/lib/nutrition/units";
import {
  checkSchema,
  extraFoodSchema,
  mealSchema,
  workoutSchema,
} from "@/lib/validation/tracking";
export type ActionResult = { error?: string; success?: boolean };
async function context(date: unknown) {
  const auth = await requireProfile();
  const d = dateSchema.parse(date);
  const today = localDate(auth.profile.timezone);
  if (d > today || d < addDays(today, -365))
    throw new Error("Choose a date within the last year, through today.");
  return { ...auth, date: d };
}
function done(error: unknown): ActionResult {
  if (error)
    return { error: "Your update could not be saved. Please try again." };
  invalidate("tracking");
  return { success: true };
}
function failed(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { error: error.issues[0].message };
  return {
    error:
      error instanceof Error && !("digest" in error)
        ? error.message
        : "Your session may have expired. Reload and try again.",
  };
}
export async function setCheck(input: unknown) {
  try {
    const d = checkSchema.parse(input);
    const { client, user } = await context(d.date);
    return done(
      (
        await client
          .from("daily_logs")
          .upsert(
            { user_id: user.id, local_date: d.date, [d.key]: d.value },
            { onConflict: "user_id,local_date" },
          )
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function logWater(input: unknown) {
  try {
    const d = z
      .object({
        date: dateSchema,
        amount: z.union([
          z.literal(-500),
          z.literal(-250),
          z.literal(250),
          z.literal(500),
          z.literal("goal"),
        ]),
      })
      .parse(input);
    const { client } = await context(d.date);
    const result =
      d.amount === "goal"
        ? await client.rpc("complete_water_goal", { p_date: d.date })
        : await client.rpc("add_water", { p_date: d.date, p_amount: d.amount });
    return done(result.error);
  } catch (e) {
    return failed(e);
  }
}
export async function logWeight(input: unknown) {
  try {
    const d = z
      .object({ date: dateSchema, weight: z.number().positive() })
      .parse(input);
    const { client, user, profile } = await context(d.date);
    const kg = toKg(d.weight, profile.units);
    if (kg < 25 || kg > 500)
      return { error: "Enter a weight between 25 and 500 kg (55–1,102 lb)." };
    return done(
      (
        await client
          .from("weight_entries")
          .upsert(
            { user_id: user.id, local_date: d.date, weight_kg: kg },
            { onConflict: "user_id,local_date" },
          )
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function deleteWeight(date: string) {
  try {
    const { client, user } = await context(date);
    return done(
      (
        await client
          .from("weight_entries")
          .delete()
          .eq("user_id", user.id)
          .eq("local_date", date)
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function logWorkout(input: unknown) {
  try {
    const d = workoutSchema.parse(input);
    const { client, user } = await context(d.date);
    const { date, ...fields } = d;
    return done(
      (
        await client
          .from("workouts")
          .upsert(
            { ...fields, user_id: user.id, local_date: date },
            { onConflict: "user_id,local_date" },
          )
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function deleteWorkout(date: string) {
  try {
    const { client, user } = await context(date);
    return done(
      (
        await client
          .from("workouts")
          .delete()
          .eq("user_id", user.id)
          .eq("local_date", date)
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function addExtra(input: unknown) {
  try {
    const d = extraFoodSchema.parse(input);
    const { client, user } = await context(d.date);
    const { date, ...fields } = d;
    return done(
      (
        await client
          .from("extra_foods")
          .insert({ ...fields, user_id: user.id, local_date: date })
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function deleteExtra(id: string) {
  try {
    z.string().uuid().parse(id);
    const { client, user } = await requireProfile();
    return done(
      (
        await client
          .from("extra_foods")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id)
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function addMeal(input: unknown) {
  try {
    const d = mealSchema.parse(input);
    const { client, user } = await context(d.date);
    const { date, ...fields } = d;
    const ids = d.ingredients.map((i) => i.food_id);
    let ingredients: { food_id: string; quantity_g: number; name: string }[] =
      [];
    if (ids.length) {
      const { data: foods, error } = await client
        .from("foods")
        .select("id,name")
        .in("id", ids);
      if (error || !foods || ids.some((id) => !foods.some((f) => f.id === id)))
        return {
          error:
            "An ingredient is no longer available. Please select it again.",
        };
      ingredients = d.ingredients.map((i) => ({
        ...i,
        name: foods.find((f) => f.id === i.food_id)!.name,
      }));
    }
    return done(
      (
        await client.from("daily_meal_logs").insert({
          ...fields,
          ingredients,
          user_id: user.id,
          local_date: date,
          status: "planned",
        })
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
export async function changeMeal(input: unknown) {
  try {
    const d = z
      .object({
        id: z.string().uuid(),
        status: z.enum(["planned", "completed", "skipped", "deleted"]),
      })
      .parse(input);
    const { client } = await requireProfile();
    return done(
      (
        await client.rpc("set_meal_status", {
          p_meal_id: d.id,
          p_status: d.status,
        })
      ).error,
    );
  } catch (e) {
    return failed(e);
  }
}
