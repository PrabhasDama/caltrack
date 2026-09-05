"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { getCatalog } from "@/lib/services/catalog";
import { pantrySchema } from "@/lib/validation/inventory";
import { quantityToGrams } from "@/lib/pantry/units";
export async function savePantry(input: unknown) {
  const p = pantrySchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { client, user } = await requireProfile();
  const { foods } = await getCatalog(client);
  const d = p.data;
  const food = foods.find((f) => f.id === d.food_id);
  if (!food) return { error: "Select an ingredient from the food library." };
  let grams: number;
  try {
    grams = quantityToGrams(d.quantity, d.unit, food);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (grams > 1000000) return { error: "Enter no more than 1,000 kg." };
  const fields = {
    food_id: d.food_id,
    quantity_g: grams,
    display_unit: d.unit,
    low_threshold_g: d.low_threshold_g,
    purchased_on: d.purchased_on,
    expires_on: d.expires_on,
  };
  const result = d.id
    ? await client
        .from("pantry_items")
        .update(fields)
        .eq("id", d.id)
        .eq("user_id", user.id)
        .eq("updated_at", d.updated_at || "")
        .select("id")
    : await client
        .from("pantry_items")
        .insert({ ...fields, user_id: user.id })
        .select("id");
  if (result.error || !result.data?.length)
    return {
      error:
        result.error?.code === "23505"
          ? "This ingredient is already in your pantry. Edit its quantity instead."
          : "The pantry changed or could not be saved. Reload before trying again.",
    };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function removePantry(input: unknown) {
  const p = z
    .object({
      id: z.string().uuid(),
      updated_at: z.string(),
      deplete: z.boolean(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Invalid pantry item." };
  const { client, user } = await requireProfile();
  const d = p.data;
  const query = d.deplete
    ? client.from("pantry_items").update({ quantity_g: 0 })
    : client.from("pantry_items").delete();
  const { data, error } = await query
    .eq("id", d.id)
    .eq("user_id", user.id)
    .eq("updated_at", d.updated_at)
    .select("id");
  if (error || !data?.length)
    return { error: "This pantry item changed. Reload and try again." };
  revalidatePath("/", "layout");
  return { success: true };
}
