import { getShoppingContext } from "@/lib/services/shopping";
import { getInventory } from "@/lib/services/inventory";
import { getDemoPricing } from "@/lib/services/pricing";
import { GroceryWorkspace } from "@/components/groceries/grocery-workspace";
import { DemoOffer } from "@/components/groceries/demo-offer";
export const metadata = { title: "Your groceries" };
export default async function Groceries() {
  const [d, pricing, context] = await Promise.all([
    getInventory(),
    getDemoPricing(),
    getShoppingContext(),
  ]);
  const offers = await pricing.provider.getOffers(
    d.foods.map((f) => f.id),
    pricing.currency,
  );
  const views: Record<string, React.ReactNode> = {};
  for (const offer of offers) {
    const food = d.foods.find((f) => f.id === offer.product.food_id);
    if (food && !views[food.id])
      views[food.id] = (
        <DemoOffer
          units={d.units}
          offer={offer}
          food={food}
          history={await pricing.provider.getPriceHistory(offer.id)}
        />
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
