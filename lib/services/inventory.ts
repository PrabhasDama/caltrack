import "server-only";
import { requireProfile } from "./auth";
import { getCatalog } from "./catalog";
import { localDate, addDays } from "@/lib/date";
import type { PantryRecord } from "@/lib/pantry/inventory";
import type { ShoppingItem } from "@/lib/groceries/requirements";
export async function getInventory(includeWaste = false) {
  const { client, user, profile } = await requireProfile();
  const reconciled = await client.rpc("reconcile_groceries");
  if (reconciled.error)
    throw new Error("Your grocery requirements could not be refreshed.");
  const [catalog, items, list, waste, movements] = await Promise.all([
    getCatalog(client),
    client
      .from("pantry_items")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    client
      .from("shopping_lists")
      .select("id,start_date,end_date,updated_at,shopping_list_items(*)")
      .eq("user_id", user.id)
      .maybeSingle(),
    includeWaste
      ? client
          .from("food_waste_events")
          .select("*")
          .eq("user_id", user.id)
          .gte("recorded_at", addDays(localDate(profile.timezone), -29))
          .order("recorded_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    includeWaste
      ? client
          .from("pantry_movements")
          .select("quantity_g")
          .eq("user_id", user.id)
          .gte("created_at", addDays(localDate(profile.timezone), -29))
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (items.error || list.error || waste.error || movements.error)
    throw new Error("Your inventory could not be loaded.");
  return {
    foods: catalog.foods,
    waste:
      waste.data as import("@/components/pantry/waste-history").WasteRecord[],
    consumed: (movements.data || []).reduce(
      (n, r) => n + Number(r.quantity_g),
      0,
    ),
    units: profile.units as "imperial" | "metric",
    pantry: items.data as PantryRecord[],
    today: localDate(profile.timezone),
    shopping: list.data
      ? {
          id: list.data.id,
          start_date: list.data.start_date,
          end_date: list.data.end_date,
          updated_at: list.data.updated_at,
          items: list.data.shopping_list_items as ShoppingItem[],
        }
      : null,
  };
}
