"use client";
import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { updateShoppingItem } from "@/app/(app)/groceries/actions";
import { markRequirement } from "@/app/(app)/groceries/session-actions";
import { PurchaseGrocery } from "./purchase-grocery";
import { EventControls } from "./session-panel";
import type { ShoppingContext } from "@/lib/shopping/types";
import { formatFoodQuantity, type Measurement } from "@/lib/food/quantities";
import { packageCombination } from "@/lib/shopping/packages";
import { formatPackage } from "@/lib/shopping/display";

import type { CatalogFood } from "@/lib/meal-plan/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
export function ShoppingRow({
  item,
  food,
  offer,
  context,
  units = "metric",
}: {
  item: ShoppingItem;
  food?: CatalogFood;
  offer?: React.ReactNode;
  context: ShoppingContext;
  units?: Measurement;
}) {
  const { pending, error, run } = useMutation();
  const [edit, setEdit] = useState(false);
  const packages = packageCombination(
    item.unit === "g" ? item.amount : 0,
    context.products.filter((p) => p.food_id === item.food_id),
  );
  return (
    <article className={`shopping-row ${item.purchased ? "purchased" : ""}`}>
      <div className="shopping-row-main">
        <div className="shopping-item-name">
          <h3>{item.name}</h3>
          <span>
            {item.source === "manual"
              ? "Added by you"
              : item.amount === 0
                ? "Covered by your pantry"
                : "From your saved meals"}
          </span>
        </div>
        <div className="buy-amount">
          <strong>
            {item.unit === "g"
              ? packages
                ? packages.packages
                    .map(
                      (p) =>
                        `${p.quantity} × ${formatPackage(p.product, food, units)}`,
                    )
                    .join(" + ")
                : formatFoodQuantity(item.amount, food, units, true)
              : `${item.amount} ${item.unit}`}
          </strong>
          <small>
            {item.purchased
              ? "Checked"
              : item.amount === 0
                ? "Stocked"
                : "To buy"}
          </small>
        </div>
        <Dialog open={edit} onOpenChange={setEdit}>
          <DialogTrigger asChild>
            <button className="icon-button" aria-label={`Edit ${item.name}`}>
              <Pencil size={14} />
            </button>
          </DialogTrigger>
          <DialogContent
            title={`Adjust ${item.name}`}
            description={`Enter your preferred amount in ${item.unit}. Recalculating restores generated quantities from meals.`}
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(
                  () =>
                    updateShoppingItem({
                      id: item.id,
                      updated_at: item.updated_at,
                      amount: Number(f.get("amount")),
                    }),
                  () => setEdit(false),
                );
              }}
            >
              <label className="field">
                Amount ({item.unit})
                <input
                  name="amount"
                  type="number"
                  min="0"
                  max="1000000"
                  step="any"
                  required
                  defaultValue={item.amount}
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              <Button disabled={pending}>Save amount</Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      updateShoppingItem({
                        id: item.id,
                        updated_at: item.updated_at,
                        remove: true,
                      }),
                    () => setEdit(false),
                  )
                }
              >
                <Trash2 size={14} /> Remove from list
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="purchase-actions">
        {item.fulfillment === "purchased" ? (
          <span className="pill">Purchased · pantry and budget updated</span>
        ) : item.fulfillment === "already_have" ? (
          <>
            <span className="pill">Already have it · no spending</span>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(() =>
                  markRequirement({
                    id: item.id,
                    state: "needed",
                    expected: item.updated_at,
                  }),
                )
              }
            >
              Need this again
            </Button>
          </>
        ) : (
          <>
            <PurchaseGrocery context={context} item={item} food={food} />
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
              Already have it
            </Button>
          </>
        )}
        {[
          ...(context.session?.events || []),
          ...context.recentSessions.flatMap((s) => s.events),
        ]
          .filter((e) => e.item_id === item.id && e.state === "purchased")
          .map((e) => (
            <EventControls key={e.id} event={e} />
          ))}
      </div>
      <div className="shopping-row-detail">
        {item.required_g !== null && (
          <span>
            Needed{" "}
            <strong>{formatFoodQuantity(item.required_g, food, units)}</strong>
          </span>
        )}
        {item.pantry_g !== null && (
          <span>
            Usable pantry{" "}
            <strong>{formatFoodQuantity(item.pantry_g, food, units)}</strong>
          </span>
        )}
        {food && item.unit === "g" && (
          <span>
            About{" "}
            <strong>
              {(item.amount / food.serving_g).toFixed(1)} servings
            </strong>
          </span>
        )}
        {offer}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
