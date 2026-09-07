"use server";
import { invalidate } from "@/lib/services/invalidation";
import { requireProfile } from "@/lib/services/auth";
import { getPlanContext } from "@/lib/services/meal-plan";
import { savePlanSchema } from "@/lib/validation/plan";
import { allowedTemplates } from "@/lib/meal-plan/restrictions";
import { mealMacros } from "@/lib/meal-plan/calculations";
import { addDays } from "@/lib/date";
export async function savePlan(input: unknown) {
  const parsed = savePlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { client } = await requireProfile();
  const context = await getPlanContext();
  const allowed = allowedTemplates(
    context.templates,
    context.foods,
    context.preferences,
  );
  for (const day of parsed.data.days) {
    if (day.date < context.today || day.date > addDays(context.today, 13))
      return { error: "Choose a day within the next two weeks." };
    for (const meal of day.meals) {
      const template = allowed.find((t) => t.id === meal.template_id);
      if (!template)
        return {
          error:
            "A meal no longer fits your preferences. Regenerate your draft.",
        };
      if (
        meal.ingredients.length !== template.items.length ||
        meal.ingredients.some(
          (i) => !template.items.some((t) => t.food_id === i.food_id),
        )
      )
        return { error: "The ingredients do not match the meal template." };
      const macros = mealMacros(meal.ingredients, context.foods);
      if (
        macros.calories > 4000 ||
        macros.protein > 300 ||
        macros.carbs > 600 ||
        macros.fat > 250 ||
        macros.fiber > 100
      )
        return {
          error:
            "A meal has unusually large portions. Regenerate it or review your targets.",
        };
    }
  }
  const { data, error } = await client.rpc("save_meal_plan", {
    p_days: parsed.data.days,
    p_revision: parsed.data.revision,
  });
  if (error)
    return {
      error:
        error.message.includes("another session") ||
        error.message.includes("protected")
          ? error.message
          : "Your plan could not be saved. Reload and retry.",
    };
  invalidate("plan");
  return { success: true, revision: Number(data) };
}
