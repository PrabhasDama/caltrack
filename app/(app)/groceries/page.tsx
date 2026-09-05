import { getInventory } from "@/lib/services/inventory";
import { getDemoPricing } from "@/lib/services/pricing";
import { GroceryWorkspace } from "@/components/groceries/grocery-workspace";
import { DemoOffer } from "@/components/groceries/demo-offer";
export const metadata = { title: "Your groceries" };
export default async function Groceries() {
  const [d, pricing] = await Promise.all([getInventory(), getDemoPricing()]);
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
          offer={offer}
          food={food}
          history={await pricing.provider.getPriceHistory(offer.id)}
        />
      );
  }
  return (
    <GroceryWorkspace
      foods={d.foods}
      shopping={d.shopping}
      today={d.today}
      offers={views}
    />
  );
}
