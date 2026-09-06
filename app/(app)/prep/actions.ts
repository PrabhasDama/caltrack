"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { dateSchema, addDays } from "@/lib/date";
import { requireProfile } from "@/lib/services/auth";
import { getPlanContext } from "@/lib/services/meal-plan";
import { buildPrepTasks, prepTaskSchema } from "@/lib/prep/planning";
export async function createPrep(input: unknown) {
  const p = z
    .object({ id: z.string().uuid(), date: dateSchema, end: dateSchema })
    .safeParse(input);
  if (!p.success) return { error: "Choose valid prep dates." };
  const [{ client, user }, context] = await Promise.all([
    requireProfile(),
    getPlanContext(),
  ]);
  const d = p.data;
  if (
    d.date < context.today ||
    d.end < d.date ||
    d.end > addDays(context.today, 13)
  )
    return { error: "Choose upcoming meals within the next 14 days." };
  const existing = await client
    .from("meal_prep_sessions")
    .select("id")
    .eq("id", d.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.data) return { success: true };
  const tasks = buildPrepTasks(context.days, context.foods, d.date, d.end);
  if (!tasks.length)
    return { error: "Save an upcoming meal plan with uneaten meals first." };
  const { error } = await client
    .from("meal_prep_sessions")
    .insert({
      id: d.id,
      user_id: user.id,
      local_date: d.date,
      start_date: d.date,
      end_date: d.end,
      source_revision: context.revision,
      tasks,
    });
  if (error)
    return { error: "Could not create your prep session. Please retry." };
  revalidatePath("/prep");
  return { success: true };
}
export async function setPrepTask(input: unknown) {
  const p = z
    .object({
      id: z.string().uuid(),
      food: z.string().uuid(),
      completed: z.boolean(),
      expected: z.string(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Invalid task." };
  const { client, user } = await requireProfile();
  const d = p.data;
  const { data: row, error } = await client
    .from("meal_prep_sessions")
    .select("tasks,updated_at")
    .eq("id", d.id)
    .eq("user_id", user.id)
    .single();
  if (error) return { error: "Prep session not found." };
  const tasks = prepTaskSchema.array().parse(row.tasks),
    task = tasks.find((t) => t.food_id === d.food);
  if (!task) return { error: "Task not found." };
  if (task.completed === d.completed) return { success: true };
  if (row.updated_at !== d.expected)
    return {
      error: "This session changed elsewhere. Refresh before updating it.",
    };
  task.completed = d.completed;
  const saved = await client
    .from("meal_prep_sessions")
    .update({ tasks })
    .eq("id", d.id)
    .eq("user_id", user.id)
    .eq("updated_at", d.expected)
    .select("id");
  if (saved.error || !saved.data?.length)
    return { error: "This session changed. Refresh and try again." };
  revalidatePath("/prep");
  return { success: true };
}
