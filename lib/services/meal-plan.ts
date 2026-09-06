import "server-only";
import { getDemoPricing } from "./pricing";
import type { PantryRecord } from "@/lib/pantry/inventory";
import { requireProfile } from "./auth";
import { getCatalog } from "./catalog";
import { localDate, addDays } from "@/lib/date";
import type { PlanContext, PlanDay, PlannedMeal } from "@/lib/meal-plan/types";
import type { Meal } from "@/types/domain";
type DayRow = {
  id: string;
  local_date: string;
  meal_plan_entries: {
    position: number;
    daily_meal_logs:
      (Meal & { template_id: string; instructions: string[] }) | null;
  }[];
};
export async function getPlanContext(): Promise<PlanContext> {
  const { client, user, profile } = await requireProfile();
  const today = localDate(profile.timezone);
  const [catalog, targets, prefs, budget, plan, days, pantry, pricing] =
    await Promise.all([
      getCatalog(client),
      client
        .from("macro_targets")
        .select("calories,protein,carbs,fat,fiber")
        .eq("user_id", user.id)
        .single(),
      client
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      client.from("budgets").select("*").eq("user_id", user.id).single(),
      client
        .from("meal_plans")
        .select("revision")
        .eq("user_id", user.id)
        .maybeSingle(),
      client
        .from("meal_plan_days")
        .select("id,local_date,meal_plan_entries(position,daily_meal_logs(*))")
        .eq("user_id", user.id)
        .gte("local_date", today)
        .lte("local_date", addDays(today, 13))
        .order("local_date"),
      client.from("pantry_items").select("*").eq("user_id", user.id),
      getDemoPricing(),
    ]);
  if ([targets, prefs, budget, plan, days, pantry].some((r) => r.error))
    throw new Error("Your plan could not be loaded.");
  const p = prefs.data;
  const offers = await pricing.provider.getOffers(
    catalog.foods.map((f) => f.id),
    budget.data.currency,
  );
  const foodCosts = Object.fromEntries(
    offers
      .filter((o) => o.product.food_id && o.product.package_grams)
      .map((o) => [
        o.product.food_id!,
        {
          package_g: o.product.package_grams!,
          price: o.price,
          currency: o.currency,
          is_demo: o.is_demo,
          observed_at: o.observed_at,
        },
      ]),
  );
  const saved: PlanDay[] = (days.data as unknown as DayRow[]).map((d) => ({
    date: d.local_date,
    meals: d.meal_plan_entries
      .sort((a, b) => a.position - b.position)
      .flatMap((e) => {
        const l = e.daily_meal_logs;
        if (!l) return [];
        const template = catalog.templates.find((t) => t.id === l.template_id);
        return [
          {
            key: `${d.local_date}-${e.position}`,
            template_id: l.template_id,
            name: l.name,
            slot: l.slot,
            ingredients: l.ingredients,
            macros: {
              calories: Number(l.calories),
              protein: Number(l.protein),
              carbs: Number(l.carbs),
              fat: Number(l.fat),
              fiber: Number(l.fiber),
            },
            instructions: template?.instructions || l.instructions,
            cooking_minutes: template?.cooking_minutes || 0,
            log_id: l.id,
            status: l.status,
          } satisfies PlannedMeal,
        ];
      }),
  }));
  return {
    ...catalog,
    pantry: pantry.data as PantryRecord[],
    foodCosts,
    today,
    units: profile.units,
    targets: targets.data!,
    preferences: {
      mealsPerDay: p.meals_per_day,
      restrictions: p.restrictions,
      excluded: p.excluded_foods,
      disliked: p.disliked_foods,
      preferred: [
        ...p.preferred_proteins,
        ...p.preferred_carbs,
        ...p.preferred_vegetables,
        ...p.preferred_fiber,
      ],
      cookingMinutes: p.cooking_minutes,
      complexity: p.complexity,
      prepFrequency: p.prep_frequency,
      repeatTolerance: p.repeat_tolerance,
      monthlyBudget: Number(budget.data.monthly_amount),
      currency: budget.data.currency,
    },
    days: saved,
    revision: plan.data?.revision || 0,
  };
}
