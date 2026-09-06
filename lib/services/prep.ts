import "server-only";
import { requireProfile } from "./auth";
import { getPlanContext } from "./meal-plan";
import { prepTaskSchema, type PrepSession } from "@/lib/prep/planning";
export async function getPrep() {
  const [{ client, user }, context] = await Promise.all([
    requireProfile(),
    getPlanContext(),
  ]);
  const { data, error } = await client
    .from("meal_prep_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Meal prep could not be loaded.");
  return {
    context,
    sessions: (data || []).map((row) => ({
      ...row,
      tasks: prepTaskSchema.array().parse(row.tasks),
    })) as PrepSession[],
  };
}
