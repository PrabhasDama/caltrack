import { getShoppingContext } from "@/lib/services/shopping";
import { getInventory } from "@/lib/services/inventory";
import { GroceryWorkspace } from "@/components/groceries/grocery-workspace";
import { PriceDisplay } from "@/components/groceries/price-display";
import { unitPrices, money } from "@/lib/pricing/calculations";
export const metadata = { title: "Your groceries" };
export default async function Groceries() {
  const [d, context] = await Promise.all([
    getInventory(),
    getShoppingContext(),
  ]);
  const offers = context.offers.filter((o) => o.currency === context.currency);
  const views: Record<string, React.ReactNode> = {};
  for (const offer of offers) {
    const food = d.foods.find((f) => f.id === offer.product.food_id);
    if (food && !views[food.id])
      views[food.id] = (
        <div className="demo-offer">
          <PriceDisplay
            value={{
              price: offer.price,
              currency: offer.currency,
              source: offer.source,
              observedAt: offer.observed_at,
              environment:
                offer.source === "provider" ? offer.environment : undefined,
              regularPrice: offer.regular_price,
            }}
          />
          <p>
            {offer.product.name} · {offer.location.name}
          </p>
          {offer.product.package_grams && (
            <p>
              {money(
                unitPrices(offer.price, offer.product.package_grams)!.per100g,
                offer.currency,
              )}{" "}
              / 100 g
            </p>
          )}
        </div>
      );
  }
  return (
    <GroceryWorkspace
      context={context}
      units={d.units}
      foods={d.foods}
      shopping={d.shopping}
      today={d.today}
      offers={views}
    />
  );
}
