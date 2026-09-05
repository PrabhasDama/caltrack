"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { purchaseSchema } from "@/lib/validation/purchases";
import { purchaseSubtotal } from "@/lib/budget/calculations";
import { localDate } from "@/lib/date";
export async function savePurchase(input: unknown) {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { client, profile } = await requireProfile();
  const d = parsed.data;
  if (d.purchased_on > localDate(profile.timezone))
    return { error: "Purchase date cannot be in the future." };
  if (purchaseSubtotal(d.items) > d.total + 0.01)
    return {
      error:
        "The purchase total must cover the item subtotal. Include tax or other charges in the total.",
    };
  const { items, ...purchase } = d;
  const { error } = await client.rpc("save_purchase", {
    p_purchase: purchase,
    p_items: items,
  });
  if (error)
    return {
      error: error.message.includes("changed")
        ? error.message
        : "Your purchase could not be saved. Check its items and retry.",
    };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function deletePurchase(input: unknown) {
  const p = z
    .object({ id: z.string().uuid(), updated_at: z.string() })
    .safeParse(input);
  if (!p.success) return { error: "Invalid purchase." };
  const { client, user } = await requireProfile();
  const { data, error } = await client
    .from("purchases")
    .delete()
    .eq("user_id", user.id)
    .eq("id", p.data.id)
    .eq("updated_at", p.data.updated_at)
    .select("id");
  if (error || !data?.length)
    return { error: "This purchase changed. Reload and try again." };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function updateBudget(input: unknown) {
  const p = z
    .object({
      amount: z.number().min(20).max(10000),
      currency: z.enum(["USD", "CAD"]),
    })
    .safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { client, user } = await requireProfile();
  const { error } = await client
    .from("budgets")
    .update({ monthly_amount: p.data.amount, currency: p.data.currency })
    .eq("user_id", user.id);
  if (error) return { error: "Your budget could not be updated." };
  revalidatePath("/", "layout");
  return { success: true };
}
