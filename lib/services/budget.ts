import "server-only";
import { z } from "zod";
import { requireProfile } from "./auth";
import { getCatalog } from "./catalog";
import { productSchema } from "./pricing";
import { localDate } from "@/lib/date";
import { purchaseItemSchema } from "@/lib/validation/purchases";
const purchaseRow = z.object({
  id: z.string(),
  store_id: z.string().nullable(),
  store_name: z.string(),
  purchased_on: z.string(),
  currency: z.enum(["USD", "CAD"]),
  total: z.coerce.number(),
  notes: z.string(),
  updated_at: z.string(),
  purchase_items: z.array(
    purchaseItemSchema.extend({
      quantity: z.coerce.number(),
      unit_price: z.coerce.number(),
    }),
  ),
});
export async function getBudget(
  requestedMonth?: string,
  requestedPage?: string,
) {
  const { client, user, profile } = await requireProfile();
  const today = localDate(profile.timezone);
  const month =
    requestedMonth && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(requestedMonth)
      ? requestedMonth
      : today.slice(0, 7);
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(requestedPage)) || 1),
  );
  const end = new Date(`${month}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const [budget, history, purchases, catalog, stores, products] =
    await Promise.all([
      client
        .from("budgets")
        .select("monthly_amount,currency")
        .eq("user_id", user.id)
        .single(),
      client.rpc("purchase_months"),
      client
        .from("purchases")
        .select("*,purchase_items(*)", { count: "exact" })
        .eq("user_id", user.id)
        .gte("purchased_on", `${month}-01`)
        .lt("purchased_on", end.toISOString().slice(0, 10))
        .order("purchased_on", { ascending: false })
        .order("id")
        .range((page - 1) * 20, page * 20 - 1),
      getCatalog(client),
      client.from("stores").select("id,name").order("name"),
      client.from("retail_products").select("*").order("name"),
    ]);
  if (
    budget.error ||
    history.error ||
    purchases.error ||
    stores.error ||
    products.error
  )
    throw new Error("Your budget could not be loaded.");
  return {
    today,
    month,
    page,
    totalPurchases: purchases.count || 0,
    budget: z
      .object({
        monthly_amount: z.coerce.number(),
        currency: z.enum(["USD", "CAD"]),
      })
      .parse(budget.data),
    history: z
      .array(
        z.object({
          month: z.string(),
          currency: z.enum(["USD", "CAD"]),
          total: z.coerce.number(),
          purchase_count: z.coerce.number(),
          shopping_days: z.coerce.number(),
        }),
      )
      .parse(history.data),
    purchases: purchaseRow
      .array()
      .parse(purchases.data)
      .map(({ purchase_items, ...p }) => ({ ...p, items: purchase_items })),
    foods: catalog.foods,
    stores: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .parse(stores.data),
    products: productSchema.array().parse(products.data),
  };
}
