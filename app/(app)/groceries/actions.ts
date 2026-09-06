"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { getCatalog } from "@/lib/services/catalog";
import { dateSchema, localDate, addDays } from "@/lib/date";
import { manualShoppingSchema } from "@/lib/validation/inventory";
import { quantityToGrams } from "@/lib/pantry/units";
export async function refreshGroceries(input: unknown) {
  const p = z.object({ start: dateSchema, end: dateSchema }).safeParse(input);
  if (!p.success) return { error: "Choose a valid shopping period." };
  const { client } = await requireProfile();
  const { error } = await client.rpc("refresh_shopping_list", {
    p_start: p.data.start,
    p_end: p.data.end,
  });
  if (error)
    return {
      error: error.message,
    };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function addShoppingItem(input: unknown) {
  const p = manualShoppingSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { client, user, profile } = await requireProfile();
  const today = localDate(profile.timezone);
  let { data: list } = await client
    .from("shopping_lists")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!list) {
    const result = await client
      .from("shopping_lists")
      .upsert(
        { user_id: user.id, start_date: today, end_date: addDays(today, 6) },
        { onConflict: "user_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (result.error) return { error: "Could not create your shopping list." };
    list = result.data;
    if (!list) {
      const again = await client
        .from("shopping_lists")
        .select("id")
        .eq("user_id", user.id)
        .single();
      list = again.data;
    }
  }
  if (!list) return { error: "Reload and try again." };
  const d = p.data;
  let amount = d.amount;
  let unit: string = d.unit;
  let name = d.name;
  if (d.food_id) {
    const { foods } = await getCatalog(client);
    const f = foods.find((f) => f.id === d.food_id);
    if (!f) return { error: "Select a known food or use a manual item." };
    try {
      amount = quantityToGrams(amount, d.unit, f);
    } catch (e) {
      return { error: (e as Error).message };
    }
    unit = "g";
    name = f.name;
  }
  const { error } = await client.from("shopping_list_items").insert({
    user_id: user.id,
    list_id: list.id,
    food_id: d.food_id,
    name,
    amount,
    unit,
    source: "manual",
  });
  if (error) return { error: "Your item could not be added." };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function updateShoppingItem(input: unknown) {
  const p = z
    .object({
      id: z.string().uuid(),
      updated_at: z.string(),
      amount: z.number().nonnegative().max(1000000).optional(),

      remove: z.boolean().optional(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Check the shopping item." };
  const { client, user } = await requireProfile();
  const d = p.data;
  const query = d.remove
    ? client.from("shopping_list_items").delete()
    : client.from("shopping_list_items").update({
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
      });
  const { data, error } = await query
    .eq("id", d.id)
    .eq("user_id", user.id)
    .eq("updated_at", d.updated_at)
    .select("id");
  if (error || !data?.length)
    return { error: "This item changed. Reload and try again." };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function clearPurchased(input: unknown) {
  const p = z.array(z.string().uuid()).max(500).safeParse(input);
  if (!p.success) return { error: "Invalid selection." };
  const { client, user } = await requireProfile();
  const { error } = await client
    .from("shopping_list_items")
    .delete()
    .eq("user_id", user.id)
    .eq("purchased", true)
    .in("id", p.data);
  if (error) return { error: "Checked items could not be cleared." };
  revalidatePath("/", "layout");
  return { success: true };
}
