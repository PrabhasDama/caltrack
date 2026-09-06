import "server-only";
import { requireProfile } from "./auth";
import { localDate, mondayOf, addDays, dateSchema, greeting } from "@/lib/date";
import type { DashboardData } from "@/types/domain";
export async function getDashboard(
  requestedDate?: string,
): Promise<DashboardData> {
  const { client, user, profile } = await requireProfile();
  const today = localDate(profile.timezone);
  const date =
    requestedDate &&
    dateSchema.safeParse(requestedDate).success &&
    requestedDate <= today &&
    requestedDate >= addDays(today, -365)
      ? requestedDate
      : today;
  const week = mondayOf(date);
  const queries = await Promise.all([
    client.from("macro_targets").select("*").eq("user_id", user.id).single(),
    client.from("user_goals").select("*").eq("user_id", user.id).single(),
    client
      .from("user_preferences")
      .select("workout_days")
      .eq("user_id", user.id)
      .single(),
    client
      .from("budgets")
      .select("monthly_amount")
      .eq("user_id", user.id)
      .single(),
    client
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("local_date", date)
      .maybeSingle(),
    client
      .from("weight_entries")
      .select("*")
      .eq("user_id", user.id)
      .lte("local_date", today)
      .order("local_date", { ascending: false })
      .limit(366),
    client
      .from("workouts")
      .select("*")
      .eq("user_id", user.id)
      .gte("local_date", week)
      .lte("local_date", addDays(week, 6)),
    client
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("local_date", week)
      .lte("local_date", addDays(week, 6)),
    client
      .from("daily_meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("local_date", date)
      .order("created_at")
      .limit(50),
    client
      .from("extra_foods")
      .select("*")
      .eq("user_id", user.id)
      .eq("local_date", date)
      .order("created_at")
      .limit(100),
    client
      .from("foods")
      .select("id,name,natural_unit,natural_unit_g")
      .order("name"),
    client
      .from("pantry_items")
      .select("quantity_g,low_threshold_g")
      .eq("user_id", user.id)
      .limit(500),
  ]);
  if (queries.some((r) => r.error))
    throw new Error("Your daily records could not be loaded. Please retry.");
  const [
    targets,
    goal,
    prefs,
    budget,
    log,
    weights,
    workouts,
    weekLogs,
    meals,
    extras,
    foods,
    pantry,
  ] = queries.map((r) => r.data);
  return {
    profile,
    date,
    today,
    greeting: greeting(profile.timezone),
    targets,
    goal,
    workoutTarget: prefs.workout_days,
    budget: Number(budget.monthly_amount),
    log: log || {
      local_date: date,
      breakfast: false,
      lunch: false,
      dinner: false,
      protein: false,
      fiber: false,
      rest_day: false,
      water_ml: 0,
    },
    weights: [...weights].reverse(),
    workouts,
    weekLogs,
    meals,
    extras,
    foods,
    pantryAlerts: pantry.filter(
      (p: { quantity_g: number; low_threshold_g: number }) =>
        p.quantity_g <= p.low_threshold_g,
    ).length,
  } as DashboardData;
}
