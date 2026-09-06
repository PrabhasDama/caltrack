import { ReceiptScanner } from "@/components/scanning/receipt-scanner";
import { getUploads } from "@/lib/services/uploads";
import { requireProfile } from "@/lib/services/auth";
import { getCatalog } from "@/lib/services/catalog";
import { productSchema } from "@/lib/services/pricing";
export const metadata = { title: "Review a receipt" };
export default async function Receipt() {
  const { client, user, profile } = await requireProfile();
  const [uploads, catalog, shopping, products] = await Promise.all([
    getUploads("receipts"),
    getCatalog(client),
    client
      .from("shopping_list_items")
      .select("id,food_id,name,amount,updated_at")
      .eq("user_id", user.id)
      .eq("fulfillment", "needed")
      .eq("unit", "g"),
    client.from("retail_products").select("*").eq("is_active", true),
  ]);
  if (shopping.error || products.error)
    throw new Error("Could not load receipt matching options");
  return (
    <ReceiptScanner
      {...uploads}
      foods={catalog.foods}
      products={productSchema.array().parse(products.data)}
      shopping={shopping.data}
      units={profile.units}
      currency={profile.country_code === "CA" ? "CAD" : "USD"}
    />
  );
}
