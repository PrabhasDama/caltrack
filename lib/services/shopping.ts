import "server-only";
import { splitPlanSchema } from "@/lib/shopping/splits";
import { z } from "zod";
import { requireProfile } from "./auth";
import { productSchema } from "./pricing";
import { getOptimizationPricing } from "./optimization-pricing";
import type { ShoppingContext, ShoppingSession } from "@/lib/shopping/types";
const sessionSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "finished"]),
  location_id: z.string().nullable(),
  purchase_id: z.string(),
  receipt: z.object({
    store_name: z.string(),
    currency: z.enum(["USD", "CAD"]),
    total: z.coerce.number(),
    purchased_on: z.string(),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      item_id: z.string().nullable(),
      state: z.enum(["purchased", "voided"]),
      added_g: z.coerce.number(),
      purchase_item_id: z.string(),
      line: z.object({
        name: z.string(),
        quantity: z.coerce.number(),
        unit: z.string(),
        unit_price: z.coerce.number(),
        price_source: z.string(),
      }),
    }),
  ),
});
export async function getShoppingContext(): Promise<ShoppingContext> {
  const { client, user, profile } = await requireProfile();
  const synchronized = await client.rpc("sync_split_plans");
  if (synchronized.error)
    throw new Error("Your saved shopping plan could not be refreshed.");
  const [sessions, stores, locations, products, pricing, preferences, splits] =
    await Promise.all([
      client
        .from("shopping_sessions")
        .select(
          "*,receipt:purchases(*),events:shopping_fulfillments(*,line:purchase_items(*))",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      client.from("stores").select("id,name").order("name"),
      client.from("store_locations").select("*").order("name"),
      client
        .from("retail_products")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      getOptimizationPricing(),
      client
        .from("store_preferences")
        .select("store_id")
        .eq("user_id", user.id),
      client
        .from("split_plans")
        .select("*,assignments:split_assignments(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  if (
    sessions.error ||
    stores.error ||
    locations.error ||
    products.error ||
    preferences.error ||
    splits.error
  )
    throw new Error("Shopping information could not be loaded.");
  const rows: ShoppingSession[] = sessionSchema.array().parse(sessions.data);
  const ps = productSchema.array().parse(products.data);
  return {
    units: profile.units,
    splits: splitPlanSchema.array().parse(splits.data),
    session: rows.find((s) => s.status === "open") || null,
    recentSessions: rows.filter((s) => s.status === "finished"),
    products: ps,
    stores: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .parse(stores.data),
    locations: z
      .array(
        z.object({
          id: z.string(),
          store_id: z.string(),
          name: z.string(),
          country_code: z.enum(["US", "CA"]),
          currency: z.enum(["USD", "CAD"]),
          is_demo: z.boolean(),
        }),
      )
      .parse(locations.data),
    offers: pricing.offers,
    preferredStores: preferences.data!.map((p) => p.store_id),
    currency: pricing.currency,
  };
}
