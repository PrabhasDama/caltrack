import "server-only";
import { z } from "zod";
import { requireProfile } from "./auth";
import { getDemoPricing, productSchema } from "./pricing";
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
  const [sessions, stores, locations, products, pricing] = await Promise.all([
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
    getDemoPricing(),
  ]);
  if (sessions.error || stores.error || locations.error || products.error)
    throw new Error("Shopping information could not be loaded.");
  const rows: ShoppingSession[] = sessionSchema.array().parse(sessions.data);
  const ps = productSchema.array().parse(products.data);
  return {
    units: profile.units,
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
    offers: [
      ...(await pricing.provider.getOffers(
        ps.flatMap((p) => (p.food_id ? [p.food_id] : [])),
        "USD",
      )),
      ...(await pricing.provider.getOffers(
        ps.flatMap((p) => (p.food_id ? [p.food_id] : [])),
        "CAD",
      )),
    ],
    currency: pricing.currency,
  };
}
