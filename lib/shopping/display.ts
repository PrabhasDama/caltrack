import type { RetailProduct } from "@/lib/pricing/types";
import type { CatalogFood } from "@/lib/meal-plan/types";
import {
  formatFoodQuantity,
  formatWeight,
  type Measurement,
} from "@/lib/food/quantities";
export function formatPackage(
  product: RetailProduct,
  food?: CatalogFood,
  units: Measurement = "metric",
) {
  return (
    (product.package_label
      ? `${product.package_label.split(" (")[0]}${product.package_grams ? ` (${formatWeight(product.package_grams, units)})` : ""}`
      : null) ||
    (product.package_grams
      ? `${formatFoodQuantity(product.package_grams, food, units)} package`
      : product.package_amount && product.package_unit
        ? `${product.package_amount} ${product.package_unit}`
        : "Package size unconfirmed")
  );
}
