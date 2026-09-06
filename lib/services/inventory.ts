import "server-only";
import { requireProfile } from "./auth";
import { getCatalog } from "./catalog";
import { localDate } from "@/lib/date";
import type { PantryRecord } from "@/lib/pantry/inventory";
import type { ShoppingItem } from "@/lib/groceries/requirements";
export async function getInventory() {
  const { client, user, profile } = await requireProfile();
  const [catalog, items, list] = await Promise.all([
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
  ]);
  if (items.error || list.error)
    throw new Error("Your inventory could not be loaded.");
  return {
    foods: catalog.foods,
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
