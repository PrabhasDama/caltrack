"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import {
  abandonSplit,
  startSplitStore,
} from "@/app/(app)/groceries/split-actions";
import { markRequirement } from "@/app/(app)/groceries/session-actions";
import { PurchaseGrocery } from "./purchase-grocery";
import type { ShoppingContext } from "@/lib/shopping/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
import type { CatalogFood } from "@/lib/meal-plan/types";
import { money } from "@/lib/pricing/calculations";
import { formatFoodQuantity } from "@/lib/food/quantities";
const labels = {
  applied: "Applied",
  partial: "Partially shopped",
  completed: "Completed",
  replaced: "Replaced",
  abandoned: "Abandoned",
  pending: "To buy",
  purchased: "Purchased",
  elsewhere: "Purchased in another flow",
  already_have: "Already have it",
  not_needed: "No longer needed",
  review: "Quantity changed · review before shopping",
};
export function SplitPlanPanel({
  context,
  items,
  foods,
  today,
  onCompare,
}: {
  context: ShoppingContext;
  items: ShoppingItem[];
  foods: CatalogFood[];
  today: string;
  onCompare: () => void;
}) {
  const { pending, error, run } = useMutation();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const plans = context.splits || [];
  const plan =
    plans.find((p) => p.status === "applied" || p.status === "partial") ||
    plans[0];
  if (!plan) return null;
  const active = ["applied", "partial"].includes(plan.status);
  const locationKey = (a: (typeof plan.assignments)[number]) =>
    a.location_id || `${a.store_name}:${a.location_name}`;
  const locations = [...new Set(plan.assignments.map(locationKey))];
  return (
    <section className="card split-plan-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SAVED BEST SPLIT</span>
          <h2>{labels[plan.status]} shopping plan</h2>
          <p>
            Saved {plan.created_at.slice(0, 10)} · expected{" "}
            {money(plan.expected_total, plan.currency)} before unrecorded
            tax/travel.
          </p>
        </div>
        <Button variant="outline" onClick={onCompare}>
          Compare a new plan
        </Button>
      </div>
      {plan.baseline_total !== null &&
        plan.baseline_total > plan.expected_total && (
          <p>
            Expected savings at application:{" "}
            {money(plan.baseline_total - plan.expected_total, plan.currency)}{" "}
            versus the comparison single-store basket.
          </p>
        )}
      <p className="fine-print">
        These are saved estimates, including demo prices where labeled. Enter
        actual prices at checkout. Shopping one store leaves the other stores
        available.
      </p>
      <div className="split-store-grid">
        {locations.map((key) => {
          const rows = plan.assignments.filter((a) => locationKey(a) === key);
          const first = rows[0];
          const ready = rows.some((a) => a.state === "pending");
          const complete = rows.every(
            (a) => !["pending", "review"].includes(a.state),
          );
          const current = context.session?.location_id === first.location_id;
          return (
            <article className="card split-store" key={key}>
              <h3>{first.store_name}</h3>
              <p>
                {first.location_name} ·{" "}
                {complete ? "Complete" : current ? "Shopping now" : "Remaining"}
              </p>
              <p>
                Expected subtotal:{" "}
                <strong>
                  {money(
                    rows.reduce(
                      (n, a) => n + a.expected_unit_price * a.package_count,
                      0,
                    ),
                    plan.currency,
                  )}
                </strong>
              </p>
              {active && ready && !current && (
                <Button
                  disabled={
                    pending || Boolean(context.session) || !first.location_id
                  }
                  onClick={() =>
                    run(
                      () =>
                        startSplitStore({
                          plan: plan.id,
                          location: first.location_id,
                          session: sessionId,
                          date: today,
                        }),
                      () => setSessionId(crypto.randomUUID()),
                    )
                  }
                >
                  Shop {first.store_name}
                </Button>
              )}
              {active && context.session && !current && ready && (
                <p className="fine-print">
                  Finish the current store to shop here next.
                </p>
              )}
              {rows.map((a) => {
                const item = items.find((i) => i.id === a.item_id);
                const food = foods.find((f) => f.id === a.food_id);
                return (
                  <div key={a.id} className="split-assignment">
                    <h4>{a.item_name}</h4>
                    <p>
                      {a.package_count} × {a.product_name} ·{" "}
                      {money(a.expected_unit_price, plan.currency)} each
                    </p>
                    <p className="fine-print">
                      Requirement when applied:{" "}
                      {formatFoodQuantity(
                        a.original_need_g,
                        food,
                        context.units,
                      )}{" "}
                      · this allocation covers{" "}
                      {formatFoodQuantity(a.allocated_g, food, context.units)} ·
                      package stock{" "}
                      {formatFoodQuantity(
                        a.package_count * a.package_g,
                        food,
                        context.units,
                      )}
                    </p>
                    <p className="fine-print">
                      {a.price_source === "demo"
                        ? "Demo pricing · simulated"
                        : `${a.price_source} observation`}{" "}
                      · {a.observed_at?.slice(0, 10) || "Date unknown"} ·{" "}
                      {labels[a.state]}
                    </p>
                    {active && a.state === "pending" && item && (
                      <div className="purchase-actions">
                        {current && (
                          <PurchaseGrocery
                            context={context}
                            item={item}
                            food={food}
                            assignment={a}
                          />
                        )}
                        <Button
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              markRequirement({
                                id: item.id,
                                state: "already_have",
                                expected: item.updated_at,
                              }),
                            )
                          }
                        >
                          Already have {a.item_name}
                        </Button>
                      </div>
                    )}
                    {a.state === "review" && (
                      <p className="notice">
                        The requirement changed. Compare and apply a new plan,
                        or shop the remaining grocery directly below. This
                        snapshot will not recreate a need.
                      </p>
                    )}
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
      {active && (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => abandonSplit(plan.id))}
        >
          Abandon this plan
        </Button>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {plans.length > 1 && (
        <details>
          <summary>Previous split plans</summary>
          {plans
            .filter((p) => p.id !== plan.id)
            .map((p) => (
              <p key={p.id}>
                {p.created_at.slice(0, 10)} · {labels[p.status]} · expected{" "}
                {money(p.expected_total, p.currency)} · {p.assignments.length}{" "}
                saved assignments
              </p>
            ))}
        </details>
      )}
    </section>
  );
}
