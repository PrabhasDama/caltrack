import "server-only";
import { z } from "zod";
import { requireProfile } from "./auth";
import { getCatalog } from "./catalog";
import { productSchema } from "./pricing";
import { localDate, addDays } from "@/lib/date";
import { purchaseItemSchema } from "@/lib/validation/purchases";
const purchaseRow = z.object({
  id: z.string(),
  origin: z.string(),
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
      price_source: z.string(),
      voided_at: z.string().nullable(),
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
  const [
    budget,
    history,
    purchases,
    catalog,
    stores,
    products,
    shopping,
    demo,
    recentMeals,
  ] = await Promise.all([
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
    client.from("shopping_list_items").select("food_id").eq("user_id", user.id),
    client.rpc("demo_spending_months"),
    client
      .from("daily_meal_logs")
      .select("ingredients")
      .eq("user_id", user.id)
      .gte("local_date", addDays(today, -30))
      .lte("local_date", addDays(today, 13))
      .order("local_date", { ascending: false })
      .limit(500),
  ]);
  if (
    budget.error ||
    history.error ||
    purchases.error ||
    stores.error ||
    products.error ||
    shopping.error ||
    demo.error ||
    recentMeals.error
  )
    throw new Error("Your budget could not be loaded.");
  return {
    today,
    units: profile.units as "imperial" | "metric",
    shoppingFoodIds: [
      ...new Set(
        (shopping.data || []).flatMap((i) =>
          i.food_id ? [i.food_id as string] : [],
        ),
      ),
    ],
    recentFoodIds: [
      ...new Set([
        ...(shopping.data || []).flatMap((i) =>
          i.food_id ? [i.food_id as string] : [],
        ),
        ...(recentMeals.data || []).flatMap((m) =>
          z
            .array(z.object({ food_id: z.string() }))
            .parse(m.ingredients)
            .map((i) => i.food_id),
        ),
        ...(purchases.data || []).flatMap((p) =>
          p.purchase_items.flatMap((i: { food_id: string | null }) =>
            i.food_id ? [i.food_id] : [],
          ),
        ),
      ]),
    ],
    demoHistory: z
      .array(
        z.object({
          month: z.string(),
          currency: z.enum(["USD", "CAD"]),
          demo_total: z.coerce.number(),
        }),
      )
      .parse(demo.data),
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
      .map(({ purchase_items, ...p }) => ({
        ...p,
        items: purchase_items.filter((i) => !i.voided_at),
      })),
    foods: catalog.foods,
    stores: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .parse(stores.data),
    products: productSchema.array().parse(products.data),
  };
}
