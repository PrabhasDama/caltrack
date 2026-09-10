import "server-only";
import { cache } from "react";
import { requireProfile } from "./auth";
import { getDemoPricing } from "./pricing";
import { localDate } from "@/lib/date";
import {
  mergeObservedPrices,
  type PurchaseObservation,
} from "@/lib/optimization/prices";
// React cache is scoped to the current server request; owner checks and RLS remain authoritative.
export const getOptimizationPricing = cache(async () => {
  const { client, user, profile } = await requireProfile();
  const [pricing, observed] = await Promise.all([
    getDemoPricing(),
    client
      .from("purchase_items")
      .select(
        "id,retail_product_id,unit_price,created_at,product:retail_products(*),purchase:purchases!inner(currency,store_location_id,purchased_on,origin,location:store_locations(*))",
      )
      .eq("user_id", user.id)
      .eq("unit", "package")
      .neq("price_source", "demo")
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (observed.error)
    throw new Error("Your price observations could not be loaded.");
  const products = await pricing.provider.searchProducts("");
  const ids = products.flatMap((p) => (p.food_id ? [p.food_id] : []));
  const all = (
    await Promise.all(
      (["USD", "CAD"] as const).map((currency) =>
        pricing.provider.getOffers(ids, currency),
      ),
    )
  ).flat();
  const reference = await Promise.all(
    all.map(async (o) => ({
      ...o,
      source: o.is_demo ? ("demo" as const) : ("provider" as const),
      history: await pricing.provider.getPriceHistory(o.id),
    })),
  );
  return {
    currency: pricing.currency,
    offers: mergeObservedPrices(
      reference,
      observed.data as unknown as PurchaseObservation[],
      localDate(profile.timezone),
    ),
  };
});
