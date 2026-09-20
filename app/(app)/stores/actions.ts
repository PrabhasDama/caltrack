"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { providerAdmin } from "@/lib/supabase/provider-admin";
import { kroger } from "@/lib/providers/server";
const calls = new Map<string, { until: number; count: number }>();
function allowed(owner: string) {
  const now = Date.now();
  for (const [k, v] of calls) if (v.until < now) calls.delete(k);
  const r = calls.get(owner) || { until: now + 60000, count: 0 };
  r.count++;
  calls.set(owner, r);
  return r.count <= 12 && calls.size <= 1000;
}
const refresh = () => {
  for (const path of ["/stores", "/groceries", "/plan", "/preferences"])
    revalidatePath(path);
};
export async function discoverStores(input: unknown) {
  const { user } = await requireProfile();
  const p = z
    .object({
      postalCode: z.string().max(12).optional(),
      radiusMiles: z.number().int().min(1).max(50),
      origin: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
        .optional(),
    })
    .safeParse(input);
  if (!p.success)
    return { error: "Enter a ZIP code and a radius from 1 to 50 miles." };
  if (!allowed(user.id))
    return { error: "Please wait a minute before another provider request." };
  const result = await kroger.getNearbyStores(p.data);
  if (!result.ok) return { error: result.message };
  const admin = providerAdmin();
  if (!admin)
    return {
      error:
        "Store discovery is configured, but saving results needs the server catalog connection.",
    };
  const rows = await Promise.all(
    result.data.map(async (store) => {
      const r = await admin.rpc("import_kroger_location", { p: store });
      if (r.error) throw Error("Location catalog update failed");
      return { ...store, id: r.data as string };
    }),
  );
  revalidatePath("/stores");
  return { stores: rows, cached: !!result.cached };
}
export async function setLocationPreference(input: unknown) {
  const { client, user } = await requireProfile();
  const p = z
    .object({
      location: z.string().uuid(),
      state: z.enum(["selected", "excluded", "none"]),
    })
    .safeParse(input);
  if (!p.success) return { error: "Invalid location preference." };
  const r =
    p.data.state === "none"
      ? await client
          .from("location_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("location_id", p.data.location)
      : await client.from("location_preferences").upsert(
          {
            user_id: user.id,
            location_id: p.data.location,
            state: p.data.state,
          },
          { onConflict: "user_id,location_id" },
        );
  if (r.error) return { error: "Your location preference could not be saved." };
  refresh();
  return { success: true };
}
export async function saveStoreSettings(input: unknown) {
  const { client } = await requireProfile();
  const p = z
    .object({
      postal: z.string().max(12),
      radius: z.number().int().min(1).max(50),
      share: z.boolean(),
    })
    .safeParse(input);
  if (!p.success) return { error: "Check your search area and radius." };
  const { error } = await client.rpc("save_location_settings", {
    p_postal: p.data.postal,
    p_radius: p.data.radius,
    p_share: p.data.share,
  });
  if (error) return { error: "Your store settings could not be saved." };
  refresh();
  return { success: true };
}
export async function searchStoreProducts(input: unknown) {
  const { client, user } = await requireProfile();
  const p = z
    .object({
      location: z.string().uuid(),
      term: z.string().min(2).max(100),
      product: z
        .string()
        .regex(/^\d{1,20}$/)
        .optional(),
      refresh: z.boolean().optional(),
    })
    .safeParse(input);
  if (!p.success)
    return {
      error: "Select a store and enter at least two search characters.",
    };
  if (!allowed(user.id))
    return { error: "Please wait a minute before another provider request." };
  const location = await client
    .from("store_locations")
    .select("provider_location_id")
    .eq("id", p.data.location)
    .eq("provider", "kroger")
    .single();
  if (location.error)
    return { error: "This retailer is not supported by Kroger." };
  const result = p.data.product
    ? await kroger.getProduct(
        p.data.product,
        location.data.provider_location_id,
      )
    : await kroger.searchProducts(
        p.data.term,
        location.data.provider_location_id,
        p.data.refresh,
      );
  if (!result.ok) return { error: result.message };
  const admin = providerAdmin();
  if (!admin)
    return { error: "The server catalog connection is not configured." };
  const imported = await admin.rpc("import_kroger_products", {
    p_location: p.data.location,
    p_products: result.data,
  });
  if (imported.error)
    return {
      error: "Provider results arrived, but could not be saved. Please retry.",
    };
  const products = await client
    .from("retail_products")
    .select("id,provider_product_id,provider_item_id")
    .eq(
      "provider",
      kroger.environment === "certification"
        ? "kroger:certification"
        : "kroger",
    )
    .in(
      "provider_product_id",
      result.data.map((p) => p.providerProductId),
    );
  if (products.error)
    return { error: "Imported products could not be loaded." };
  refresh();
  return {
    products: result.data.map((p) => ({
      ...p,
      id: products.data.find(
        (r) =>
          r.provider_product_id === p.providerProductId &&
          r.provider_item_id === p.providerItemId,
      )?.id as string,
    })),
    cached: !!result.cached,
  };
}
export async function confirmStoreProduct(input: unknown) {
  const { client } = await requireProfile();
  const p = z
    .object({
      product: z.string().uuid(),
      food: z.string().uuid(),
      grams: z.number().positive().max(1000000),
    })
    .safeParse(input);
  if (!p.success)
    return {
      error: "Choose the matching food and confirm the package weight.",
    };
  const { error } = await client.rpc("confirm_product_match", {
    p_product: p.data.product,
    p_food: p.data.food,
    p_grams: p.data.grams,
  });
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}
