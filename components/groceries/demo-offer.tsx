import {
  money,
  unitPrices,
  priceHistoryStats,
} from "@/lib/pricing/calculations";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { StoreOffer, PriceObservation } from "@/lib/pricing/types";
export function DemoOffer({
  offer,
  food,
  history,
}: {
  offer: StoreOffer;
  food: CatalogFood;
  history: PriceObservation[];
}) {
  const prices = unitPrices(
    offer.price,
    offer.product.package_grams,
    food.serving_g,
    food.nutrition,
  );
  const stats = priceHistoryStats(history, offer.currency, offer.observed_at);
  return (
    <div className="demo-offer">
      <span className="status-pill">Demo pricing</span>
      <strong>
        {money(offer.price, offer.currency)} / {offer.product.package_amount}{" "}
        {offer.product.package_unit}
      </strong>
      <p>
        {offer.product.name} · {offer.location.name}
      </p>
      {prices && (
        <p>
          {money(prices.per100g, offer.currency)} / 100 g
          {prices.perServing !== null &&
            ` · ${money(prices.perServing, offer.currency)} / reference serving`}
        </p>
      )}
      {stats && (
        <p>
          Sample history: low {money(stats.low, offer.currency)} · high{" "}
          {money(stats.high, offer.currency)} · 30-day average{" "}
          {stats.recentAverage === null
            ? "unavailable"
            : money(stats.recentAverage, offer.currency)}
        </p>
      )}
      <p className="fine-print muted">
        Simulated offer from the demo provider · observed{" "}
        {offer.observed_at.slice(0, 10)}. Illustrative data, not a retailer
        quote.
      </p>
      {offer.promotion && (
        <p className="fine-print">
          Sample promotion recorded with this observation: {offer.promotion}
        </p>
      )}
    </div>
  );
}
