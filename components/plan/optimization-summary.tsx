"use client";
import { useMemo } from "react";
import { optimizerCache } from "@/lib/optimization/cache";
import {
  priceQuality,
  objectives,
  type Objective,
  type Cart,
} from "@/lib/optimization/engine";
import type { PlanContext, PlanDay } from "@/lib/meal-plan/types";
import { formatFoodQuantity } from "@/lib/food/quantities";
import { money } from "@/lib/pricing/calculations";
export function OptimizationSummary({
  context,
  days,
  objective,
  onObjective,
  onSettings,
}: {
  context: PlanContext;
  days: PlanDay[];
  objective: Objective;
  onObjective: (o: Objective) => void;
  onSettings?: (p: { maxStores?: number; extraStorePenalty?: number }) => void;
}) {
  const result = useMemo(
    () => optimizerCache.get(days, context, objective),
    [days, context, objective],
  );
  const currency = context.preferences.currency;
  const demo = context.optimization?.offers.some((o) => o.source === "demo");
  return (
    <section className="card optimization-summary">
      <h2>Your week, with a little more intention.</h2>
      <label className="field">
        Optimize for
        <select
          value={objective}
          onChange={(e) => onObjective(e.target.value as Objective)}
        >
          {objectives.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <p className="notice">
        {demo
          ? "Demo pricing · simulated estimates, not current retailer prices."
          : "Estimates from available observations; confirm prices before buying."}{" "}
        Results are bounded recommendations, not a guarantee of the lowest
        possible cost.
      </p>
      {!!days.length ? (
        <>
          <div className="budget-metrics">
            <div>
              <strong>{result.nutritionFit}%</strong>
              <p>Nutrition fit · planned meals</p>
            </div>
            <div>
              <strong>{Math.round(result.pantry.coverage * 100)}%</strong>
              <p>Pantry coverage by weight</p>
            </div>
            <div>
              <strong>
                {result.estimatedSpend === null
                  ? "Estimate unavailable"
                  : money(result.estimatedSpend, currency)}
              </strong>
              <p>Additional packages this plan</p>
            </div>
          </div>
          <p>
            Remaining monthly budget: {money(result.remaining, currency)} ·
            Horizon allowance: {money(result.allowance, currency)} ·{" "}
            {result.cart?.stores.length || 0} stores
          </p>
          <p>
            {result.projectedMonth === null
              ? "Monthly projection needs at least seven days and two shopping dates."
              : `Observed spending pace: ${money(result.projectedMonth, currency)} / ${money(context.preferences.monthlyBudget, currency)} this month.`}
          </p>
          {result.estimatedSpend !== null &&
            result.estimatedSpend > result.allowance && (
              <p className="notice">
                This plan’s package estimate exceeds the remaining budget
                allowance. Try Lowest Cost or Pantry First.
              </p>
            )}
          <details>
            <summary>Stock to watch</summary>
            {result.pantry.runout.length ? (
              result.pantry.runout.map((r) => (
                <p key={r.food_id}>
                  {context.foods.find((f) => f.id === r.food_id)?.name}: current
                  stock falls short around {r.date}, based on saved portions and
                  expiry.
                </p>
              ))
            ) : (
              <p>
                Current stock covers this plan, or no dated ingredient demand is
                available.
              </p>
            )}
          </details>
        </>
      ) : (
        <p>
          Generate or save meals to compare this week’s budget and pantry use.
        </p>
      )}
      {onSettings && (
        <details>
          <summary>Shopping convenience</summary>
          <label className="field">
            Maximum stores
            <select
              value={context.optimization?.maxStores || 2}
              onChange={(e) =>
                onSettings({ maxStores: Number(e.target.value) })
              }
            >
              <option>1</option>
              <option>2</option>
              <option>3</option>
            </select>
          </label>
          <label className="field">
            Extra trip inconvenience ({currency})
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={context.optimization?.extraStorePenalty || 0}
              onChange={(e) =>
                onSettings({
                  extraStorePenalty: Math.min(
                    100,
                    Math.max(0, Number(e.target.value)),
                  ),
                })
              }
            />
          </label>
          <p className="fine-print">
            A comparison penalty, not a receipt charge. Distance is unknown
            without a configured provider.
          </p>
        </details>
      )}
      {result.carts && (
        <>
          <h3>Compare shopping plans</h3>
          <p className="fine-print">
            Best Split includes the extra-store penalty. Savings are
            package-price estimates before unrecorded tax or travel.
          </p>
          {result.carts.savings !== null && result.carts.savings > 0 && (
            <p>
              Best Split saves about {money(result.carts.savings, currency)}{" "}
              versus the preferred or cheapest complete single-store basket.
            </p>
          )}
          <div className="optimizer-carts">
            {(
              [
                ["Cheapest single store", result.carts.single],
                ["Best Split", result.carts.bestSplit],
                ["Fewest stores", result.carts.fewest],
              ] as [string, Cart][]
            ).map(([name, cart]) => (
              <CartView key={name} name={name} cart={cart} context={context} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
export function CartView({
  name,
  cart,
  context,
}: {
  name: string;
  cart: Cart;
  context: PlanContext;
}) {
  const currency = context.preferences.currency;
  return (
    <details className="optimizer-cart">
      <summary>
        <strong>{name}</strong> ·{" "}
        {cart.total === null
          ? `${money(cart.subtotal, currency)} priced portion`
          : money(cart.total, currency)}{" "}
        · {cart.stores.length} stores
      </summary>
      {cart.missing.length > 0 && (
        <p className="notice">
          Unpriced: {cart.missing.map((m) => m.name).join(", ")}. Full cost and
          savings are unavailable.
        </p>
      )}
      {!cart.distanceKnown && (
        <p className="fine-print">Distance / travel cost unavailable.</p>
      )}
      {cart.stores.map((id) => (
        <section key={id}>
          <h4>
            {
              cart.lines
                .flatMap((l) => l.packages)
                .find((p) => p.offer.location.id === id)?.offer.location.name
            }
          </h4>
          {cart.lines
            .filter((l) => l.packages.some((p) => p.offer.location.id === id))
            .map((l) => (
              <div key={l.food_id} className="optimizer-line">
                <strong>{l.name}</strong>
                <p>
                  Need{" "}
                  {formatFoodQuantity(
                    l.requiredG,
                    context.foods.find((f) => f.id === l.food_id),
                    context.units,
                  )}{" "}
                  · buy{" "}
                  {formatFoodQuantity(
                    l.grams,
                    context.foods.find((f) => f.id === l.food_id),
                    context.units,
                  )}{" "}
                  · leftover{" "}
                  {formatFoodQuantity(
                    l.leftoverG,
                    context.foods.find((f) => f.id === l.food_id),
                    context.units,
                  )}
                </p>
                {l.packages
                  .filter((p) => p.offer.location.id === id)
                  .map((p) => {
                    const q = priceQuality(p.offer, context.today);
                    return (
                      <p key={p.offer.id}>
                        {p.count} ×{" "}
                        {p.offer.product.package_label || p.offer.product.name}:{" "}
                        {money(p.offer.price * p.count, currency)} ·{" "}
                        {p.offer.source} · observed{" "}
                        {p.offer.observed_at.slice(0, 10)} · {q.status}
                        {q.average !== null
                          ? ` · 30-day average ${money(q.average, currency)}, low ${money(q.low!, currency)}, high ${money(q.high!, currency)}`
                          : " · too little history for a price rating"}
                      </p>
                    );
                  })}
              </div>
            ))}
        </section>
      ))}
    </details>
  );
}
