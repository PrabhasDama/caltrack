import "server-only";
import { z } from "zod";
import { requireProfile } from "./auth";
import { DemoPriceProvider } from "@/lib/pricing/providers/demo";
const currency = z.enum(["USD", "CAD"]);
export const productSchema = z.object({
  id: z.string(),
  food_id: z.string().nullable(),
  name: z.string(),
  package_amount: z.coerce.number(),
  package_unit: z.string(),
  package_grams: z.coerce.number().nullable(),
});
const offerSchema = z.object({
  id: z.string(),
  product: productSchema,
  location: z.object({
    id: z.string(),
    store_id: z.string(),
    name: z.string(),
    country_code: z.enum(["US", "CA"]),
    currency,
    is_demo: z.boolean(),
  }),
  price: z.coerce.number(),
  currency,
  observed_at: z.string(),
  provider: z.string(),
  is_demo: z.boolean(),
  promotion: z.string().nullable(),
});
export async function getDemoPricing() {
  const { client, user } = await requireProfile();
  const [offers, history, deals, budget] = await Promise.all([
    client
      .from("store_offers")
      .select("*,product:retail_products(*),location:store_locations(*)")
      .eq("provider", "demo")
      .eq("is_demo", true),
    client
      .from("price_history")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(1000),
    client.from("deals").select("*").eq("is_demo", true),
    client.from("budgets").select("currency").eq("user_id", user.id).single(),
  ]);
  if (offers.error || history.error || deals.error || budget.error)
    throw new Error("Price information could not be loaded.");
  return {
    currency: currency.parse(budget.data.currency),
    provider: new DemoPriceProvider(
      offerSchema.array().parse(offers.data),
      z
        .object({
          id: z.string(),
          offer_id: z.string(),
          price: z.coerce.number(),
          currency,
          observed_at: z.string(),
        })
        .array()
        .parse(history.data),
      z
        .object({
          id: z.string(),
          offer_id: z.string(),
          description: z.string(),
          starts_at: z.string(),
          ends_at: z.string(),
        })
        .array()
        .parse(deals.data),
    ),
  };
}
