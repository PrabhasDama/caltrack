"use server";
import { z } from "zod";
import { invalidate } from "@/lib/services/invalidation";
import { requireProfile } from "@/lib/services/auth";
import { dateSchema } from "@/lib/date";
const id = z.string().uuid();
const price = z.number().nonnegative().max(1000000).multipleOf(0.01);
async function rpc(name: string, args: Record<string, unknown>) {
  const { client } = await requireProfile();
  const { error } = await client.rpc(name, args);
  if (error) return { error: error.message };
  invalidate("purchase");
  return { success: true };
}
export async function startShopping(input: unknown) {
  const p = z
    .object({
      id,
      store: id.nullable(),
      location: id.nullable(),
      name: z.string().trim().min(1).max(120),
      currency: z.enum(["USD", "CAD"]),
      date: dateSchema,
    })
    .safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  return rpc("start_shopping_session", {
    p_id: d.id,
    p_store: d.store,
    p_location: d.location,
    p_name: d.name,
    p_currency: d.currency,
    p_date: d.date,
  });
}
export async function purchaseGrocery(input: unknown) {
  const p = z
    .object({
      request: id,
      session: id,
      item: id,
      expected: z.string(),
      product: id.nullable(),
      offer: id.nullable(),
      quantity: z.number().positive().max(1000000),
      unit: z.enum(["g", "kg", "oz", "lb", "piece", "serving", "package"]),
      price,
      priceSource: z.enum(["manual", "demo", "provider"]),
      expires: dateSchema.nullable(),
    })
    .safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  return rpc("fulfill_shopping_item", {
    p_request: d.request,
    p_session: d.session,
    p_item: d.item,
    p_expected: d.expected,
    p_product: d.product,
    p_offer: d.offer,
    p_quantity: d.quantity,
    p_unit: d.unit,
    p_price: d.price,
    p_price_source: d.priceSource,
    p_expires: d.expires,
  });
}
export async function markRequirement(input: unknown) {
  const p = z
    .object({
      id,
      state: z.enum(["needed", "already_have"]),
      expected: z.string(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Invalid requirement" };
  return rpc("mark_shopping_requirement", {
    p_item: p.data.id,
    p_state: p.data.state,
    p_expected: p.data.expected,
  });
}
export async function undoGroceryPurchase(event: unknown) {
  const p = id.safeParse(event);
  if (!p.success) return { error: "Invalid purchase" };
  return rpc("undo_shopping_purchase", { p_event: p.data });
}
export async function correctGroceryPrice(input: unknown) {
  const p = z.object({ id, price }).safeParse(input);
  if (!p.success) return { error: "Enter a valid price" };
  return rpc("correct_shopping_purchase", {
    p_event: p.data.id,
    p_price: p.data.price,
  });
}
export async function finishShopping(session: unknown) {
  const p = id.safeParse(session);
  if (!p.success) return { error: "Invalid session" };
  return rpc("finish_shopping_session", { p_session: p.data });
}
