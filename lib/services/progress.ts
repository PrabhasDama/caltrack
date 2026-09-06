import "server-only";
import { requireProfile } from "./auth";
import { allRows } from "./paginate";
import { addDays, localDate } from "@/lib/date";
import type { BodyMeasurement, NutritionLog } from "@/lib/progress/analytics";
import type { TimedMeal } from "@/lib/progress/meal-times";
import type { WeightEntry, Profile, Targets } from "@/types/domain";
export async function getProgress() {
  const { client, user, profile } = await requireProfile();
  const today = localDate(profile.timezone),
    from = addDays(today, -41);
  const [
    weights,
    measurements,
    meals,
    extras,
    workouts,
    purchases,
    budget,
    targets,
    goal,
    prefs,
  ] = await Promise.all([
    allRows<WeightEntry>((a, b) =>
      client
        .from("weight_entries")
        .select("id,local_date,weight_kg")
        .eq("user_id", user.id)
        .lte("local_date", today)
        .order("local_date")
        .range(a, b),
    ),
    allRows<BodyMeasurement>((a, b) =>
      client
        .from("body_measurements")
        .select("*")
        .eq("user_id", user.id)
        .lte("local_date", today)
        .order("local_date")
        .range(a, b),
    ),
    allRows<NutritionLog & TimedMeal>((a, b) =>
      client
        .from("daily_meal_logs")
        .select(
          "local_date,status,slot,completed_at,calories,protein,carbs,fat,fiber",
        )
        .eq("user_id", user.id)
        .or(`local_date.gte.${from},completed_at.gte.${from}T00:00:00Z`)
        .lte("local_date", today)
        .order("id")
        .range(a, b),
    ),
    allRows<NutritionLog>((a, b) =>
      client
        .from("extra_foods")
        .select("local_date,calories,protein,carbs,fat,fiber")
        .eq("user_id", user.id)
        .gte("local_date", from)
        .lte("local_date", today)
        .order("id")
        .range(a, b),
    ),
    allRows<{ local_date: string }>((a, b) =>
      client
        .from("workouts")
        .select("local_date")
        .eq("user_id", user.id)
        .gte("local_date", from)
        .lte("local_date", today)
        .order("id")
        .range(a, b),
    ),
    allRows<{ purchased_on: string; total: number; currency: string }>((a, b) =>
      client
        .from("purchases")
        .select("purchased_on,total,currency")
        .eq("user_id", user.id)
        .gte("purchased_on", from)
        .lte("purchased_on", today)
        .order("id")
        .range(a, b),
    ),
    client
      .from("budgets")
      .select("currency,monthly_amount")
      .eq("user_id", user.id)
      .single(),
    client.from("macro_targets").select("*").eq("user_id", user.id).single(),
    client
      .from("user_goals")
      .select("goal,goal_weight_kg")
      .eq("user_id", user.id)
      .single(),
    client
      .from("user_preferences")
      .select("workout_days")
      .eq("user_id", user.id)
      .single(),
  ]);
  if ([budget, targets, goal, prefs].some((r) => r.error))
    throw new Error("Your budget could not be loaded.");
  return {
    profile: profile as Profile,
    today,
    targets: targets.data as Targets,
    goal: goal.data as { goal: string; goal_weight_kg: number },
    workoutTarget: Number(prefs.data!.workout_days),
    weights,
    measurements,
    analytics: {
      meals,
      extras,
      workouts,
      purchases,
      currency: budget.data!.currency as "USD" | "CAD",
      budget: Number(budget.data!.monthly_amount),
    },
  };
}
export type ProgressData = Awaited<ReturnType<typeof getProgress>>;
