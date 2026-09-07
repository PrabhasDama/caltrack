import { money } from "@/lib/pricing/calculations";
import { formatFoodQuantity } from "@/lib/food/quantities";
import type { CatalogFood } from "@/lib/meal-plan/types";
export type WasteRecord = {
  id: string;
  food_id: string;
  quantity_g: number;
  reason: string;
  recorded_at: string;
  estimated_cost: number | null;
  currency: "USD" | "CAD" | null;
};
export function WasteHistory({
  events,
  foods,
  consumed,
  units,
}: {
  events: WasteRecord[];
  foods: CatalogFood[];
  consumed: number;
  units: "metric" | "imperial";
}) {
  const repeated = [...new Set(events.map((e) => e.food_id))].filter(
    (id) => events.filter((e) => e.food_id === id).length >= 3,
  );
  return (
    <section className="card">
      <h2>Pantry use & waste</h2>
      <p>
        Last 30 days: {formatFoodQuantity(consumed, undefined, units)} used from
        pantry by completed meals. This excludes ingredients that were not
        stocked.
      </p>
      <details>
        <summary>{events.length} recorded waste events</summary>
        {events.length ? (
          events.map((e) => (
            <p key={e.id}>
              {e.recorded_at.slice(0, 10)} ·{" "}
              {foods.find((f) => f.id === e.food_id)?.name} ·{" "}
              {formatFoodQuantity(
                Number(e.quantity_g),
                foods.find((f) => f.id === e.food_id),
                units,
              )}{" "}
              {e.reason} ·{" "}
              {e.estimated_cost !== null && e.currency
                ? `${money(Number(e.estimated_cost), e.currency)} estimated from a past purchase`
                : "Cost unavailable"}
            </p>
          ))
        ) : (
          <p>
            No waste recorded in the last 30 days. Depleting an item alone does
            not record waste.
          </p>
        )}
      </details>
      {repeated.map((id) => (
        <p className="notice" key={id}>
          You recorded waste for {foods.find((f) => f.id === id)?.name} at least
          three times this month. Consider a smaller package or buying less
          often. Savings depend on the available package prices and are not
          estimated here.
        </p>
      ))}
      <p className="fine-print">
        Up to 500 recent waste and consumption records are included. Cost
        estimates use recorded purchase prices, not a current retailer quote.
      </p>
    </section>
  );
}
