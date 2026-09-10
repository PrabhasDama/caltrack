"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { getInventory } from "@/lib/services/inventory";
import { getShoppingContext } from "@/lib/services/shopping";
import { compareCarts } from "@/lib/optimization/engine";
import { splitLineInput, splitProposal } from "@/lib/shopping/splits";
import { invalidate } from "@/lib/services/invalidation";
export async function applySplit(input: unknown) {
  const parsed = z
    .object({
      maximum: z.number().int().min(1).max(3),
      penalty: z.number().min(0).max(100),
      lines: z.array(splitLineInput).min(1).max(100),
    })
    .safeParse(input);
  if (!parsed.success)
    return { error: "Choose a valid, fully priced recommendation." };
  const { client } = await requireProfile();
  const { maximum, penalty, lines } = parsed.data;
  // Only an explicit Apply evaluates current inputs; reopening a saved plan reads its rows.
  const [inventory, context] = await Promise.all([
    getInventory(),
    getShoppingContext(),
  ]);
  const items = (inventory.shopping?.items || []).filter(
    (i) => i.fulfillment === "needed" && i.amount > 0,
  );
  if (items.some((i) => !i.food_id || i.unit !== "g"))
    return {
      error: "Match each grocery to a food and gram requirement first.",
    };
  const result = compareCarts(
    items.map((i) => ({ food_id: i.food_id!, name: i.name, grams: i.amount })),
    {
      offers: context.offers,
      spent: 0,
      shoppingDays: 0,
      preferredStores: context.preferredStores || [],
      distancesKm: {},
      maxStores: maximum,
      extraStorePenalty: penalty,
      travelCostPerKm: 0,
    },
    context.currency,
  );
  if (result.bestSplit.total === null)
    return { error: "Some items are unpriced. Review your basket first." };
  const current = splitProposal(result.bestSplit, items);
  if (JSON.stringify(current) !== JSON.stringify(lines))
    return {
      error:
        "The recommendation changed. Reload and review it before applying.",
    };
  const { data, error } = await client.rpc("apply_split_plan", {
    p_lines: current,
    p_currency: context.currency,
    p_max_stores: maximum,
    p_penalty: penalty,
    p_baseline: result.baseline.total,
  });
  if (error) return { error: error.message };
  revalidatePath("/groceries");
  return { id: data };
}
export async function abandonSplit(id: string) {
  const { client } = await requireProfile();
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid plan" };
  const { error } = await client.rpc("abandon_split_plan", { p_plan: id });
  if (error) return { error: error.message };
  revalidatePath("/groceries");
  return { success: true };
}
export async function startSplitStore(input: unknown) {
  const p = z
    .object({
      plan: z.string().uuid(),
      location: z.string().uuid(),
      session: z.string().uuid(),
      date: z.string(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Invalid store" };
  const { client } = await requireProfile();
  const { error } = await client.rpc("start_split_store", {
    p_plan: p.data.plan,
    p_location: p.data.location,
    p_session: p.data.session,
    p_date: p.data.date,
  });
  if (error) return { error: error.message };
  invalidate("purchase");
  return { success: true };
}
export async function buySplitAssignment(input: unknown) {
  const p = z
    .object({
      assignment: z.string().uuid(),
      request: z.string().uuid(),
      session: z.string().uuid(),
      expected: z.string(),
      product: z.string().uuid().nullable(),
      quantity: z.number().positive().max(1000000),
      unit: z.enum(["package", "g", "kg", "oz", "lb", "piece", "serving"]),
      price: z.number().nonnegative().max(1000000).multipleOf(0.01),
      expires: z.string().nullable(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Enter a valid quantity and actual price" };
  const { client } = await requireProfile();
  const d = p.data;
  const { error } = await client.rpc("purchase_split_assignment", {
    p_assignment: d.assignment,
    p_request: d.request,
    p_session: d.session,
    p_expected: d.expected,
    p_product: d.product,
    p_quantity: d.quantity,
    p_unit: d.unit,
    p_price: d.price,
    p_expires: d.expires,
  });
  if (error) return { error: error.message };
  invalidate("purchase");
  return { success: true };
}
