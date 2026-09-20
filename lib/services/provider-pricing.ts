import "server-only";
import { cache } from "react";
import { requireProfile } from "./auth";
import { offerSchema, productSchema } from "./pricing";
import type { Offer } from "@/lib/optimization/engine";
export const getProviderPricing = cache(async () => {
  const { client, user } = await requireProfile();
  const [raw, products, prefs, history] = await Promise.all([
    client
      .from("store_offers")
      .select("*,product:retail_products(*),location:store_locations(*)")
      .eq("is_demo", false),
    client.rpc("effective_products"),
    client
      .from("location_preferences")
      .select("location_id,state")
      .eq("user_id", user.id),
    client
      .from("price_history")
      .select("offer_id,price,observed_at")
      .neq("source", "demo")
      .gte("observed_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(2000),
  ]);
  if (raw.error || products.error || prefs.error || history.error)
    throw Error("Store prices could not be loaded.");
  const mapped = productSchema.array().parse(products.data);
  const offers: Offer[] = offerSchema
    .array()
    .parse(raw.data.filter((r) => r.product && r.location))
    .map((o) => ({
      ...o,
      product: mapped.find((p) => p.id === o.product.id) || o.product,
      source: "provider",
      history: history.data
        .filter((h) => h.offer_id === o.id)
        .map((h) => ({ price: Number(h.price), observed_at: h.observed_at })),
    }));
  return { offers, products: mapped, preferences: prefs.data };
});
