import { requireUser } from "@/lib/services/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const { client, user } = await requireUser();
  const tables = [
    "profiles",
    "user_goals",
    "macro_targets",
    "user_preferences",
    "store_preferences",
    "budgets",
    "notification_preferences",
    "daily_logs",
    "weight_entries",
    "body_measurements",
    "user_uploads",
    "receipt_price_observations",
    "meal_completion_events",
    "meal_prep_sessions",
    "workouts",
    "daily_meal_logs",
    "extra_foods",
    "pantry_items",
    "pantry_movements",
    "food_waste_events",
    "meal_plans",
    "meal_plan_days",
    "meal_plan_entries",
    "shopping_lists",
    "shopping_list_items",
    "shopping_sessions",
    "shopping_fulfillments",
    "purchases",
    "purchase_items",
  ];
  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    format_version: 4,
  };
  for (const table of tables) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq(table === "profiles" ? "id" : "user_id", user.id)
        .order("id")
        .range(offset, offset + 499);
      if (error)
        return Response.json(
          { error: "Export failed. Please retry." },
          { status: 500 },
        );
      rows.push(...data);
      if (data.length < 500) break;
    }
    result[table] = rows;
  }
  const privateFoods: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("foods")
      .select("*,food_nutrition(*)")
      .eq("user_id", user.id)
      .order("id")
      .range(offset, offset + 499);
    if (error || !data)
      return Response.json(
        { error: "Export failed. Please retry." },
        { status: 500 },
      );
    privateFoods.push(...data);
    if (data.length < 500) break;
  }
  result.private_foods = privateFoods;
  return new Response(JSON.stringify(result, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="caltrack-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
