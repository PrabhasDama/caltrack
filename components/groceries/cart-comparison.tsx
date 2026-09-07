"use client";
import { useMemo, useState } from "react";
import { compareCarts } from "@/lib/optimization/engine";
import { CartView } from "@/components/plan/optimization-summary";
import type { ShoppingContext } from "@/lib/shopping/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
import type { CatalogFood, PlanContext } from "@/lib/meal-plan/types";
import { money } from "@/lib/pricing/calculations";
export function CartComparison({
  items,
  context,
  foods,
  today,
}: {
  items: ShoppingItem[];
  context: ShoppingContext;
  foods: CatalogFood[];
  today: string;
}) {
  const [maximum, setMaximum] = useState(2),
    [penalty, setPenalty] = useState(5);
  const result = useMemo(
    () =>
      compareCarts(
        items
          .filter((i) => i.food_id && i.unit === "g")
          .map((i) => ({
            food_id: i.food_id!,
            name: i.name,
            grams: Number(i.amount),
          })),
        {
          offers: context.offers,
          spent: 0,
          shoppingDays: 0,
          preferredStores: context.session?.location_id
            ? context.locations
                .filter((l) => l.id === context.session!.location_id)
                .map((l) => l.store_id)
            : context.preferredStores || [],
          distancesKm: {},
          maxStores: maximum,
          extraStorePenalty: penalty,
          travelCostPerKm: 0,
        },
        context.currency,
      ),
    [items, context, maximum, penalty],
  );
  const display = {
    foods,
    today,
    units: context.units,
    preferences: { currency: context.currency },
  } as PlanContext;
  const unconverted = items.filter((i) => !i.food_id || i.unit !== "g");
  const swaps = result.bestSplit.lines.flatMap((line) => {
    const before = result.baseline.lines.find(
      (l) => l.food_id === line.food_id,
    );
    return before && before.cost > line.cost
      ? [{ before, line, savings: before.cost - line.cost }]
      : [];
  });
  return (
    <section className="card">
      <h2>Compare this shopping basket</h2>
      <p className="notice">
        Demo pricing where marked · observed estimates, not verified current
        retailer prices. Distance is unavailable.
      </p>
      <div className="form-grid">
        <label className="field">
          Maximum stores
          <select
            value={maximum}
            onChange={(e) => setMaximum(Number(e.target.value))}
          >
            <option>1</option>
            <option>2</option>
            <option>3</option>
          </select>
        </label>
        <label className="field">
          Extra store penalty ({context.currency})
          <input
            type="number"
            min="0"
            max="100"
            value={penalty}
            onChange={(e) =>
              setPenalty(Math.min(100, Math.max(0, Number(e.target.value))))
            }
          />
        </label>
      </div>
      {unconverted.length > 0 && (
        <p className="notice">
          Not included: {unconverted.map((i) => i.name).join(", ")}. Match a
          food and gram quantity for complete cart estimates. No whole-basket
          savings can be calculated yet.
        </p>
      )}
      <CartView
        name="Cheapest single store"
        cart={result.single}
        context={display}
      />
      <CartView name="Best Split" cart={result.bestSplit} context={display} />
      <CartView name="Fewest stores" cart={result.fewest} context={display} />
      {!unconverted.length && result.savings !== null && result.savings > 0 && (
        <p>
          Estimated basket savings: {money(result.savings, context.currency)}{" "}
          versus the baseline single store, before travel/tax.
        </p>
      )}
      <h3>Smart product swaps</h3>
      {swaps.length ? (
        swaps.slice(0, 7).map(({ before, line, savings }) => (
          <p key={line.food_id}>
            {before.packages.map((p) => p.offer.product.name).join(" + ")} →{" "}
            {line.packages.map((p) => p.offer.product.name).join(" + ")} · Save
            about {money(savings, context.currency)} for this basket. Same food
            reference; brand-specific nutrition is not verified.
          </p>
        ))
      ) : (
        <p>
          No priced product changes save money for this basket under your
          current store limit.
        </p>
      )}
      <p className="fine-print">
        Use the store and package details above when confirming purchases below.
        Shopping transactions add the full purchased quantity, including
        leftovers, to pantry.
      </p>
    </section>
  );
}
