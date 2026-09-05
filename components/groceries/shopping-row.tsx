"use client";
import { useState } from "react";
import { Check, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { updateShoppingItem } from "@/app/(app)/groceries/actions";
import { formatGrams } from "@/lib/pantry/units";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
export function ShoppingRow({
  item,
  food,
  offer,
}: {
  item: ShoppingItem;
  food?: CatalogFood;
  offer?: React.ReactNode;
}) {
  const { pending, error, run } = useMutation();
  const [edit, setEdit] = useState(false);
  return (
    <article className={`shopping-row ${item.purchased ? "purchased" : ""}`}>
      <div className="shopping-row-main">
        <button
          className={`shopping-check ${item.purchased ? "checked" : ""}`}
          aria-pressed={item.purchased}
          aria-label={`Mark ${item.name} ${item.purchased ? "unpurchased" : "purchased"}`}
          disabled={pending}
          onClick={() =>
            run(() =>
              updateShoppingItem({
                id: item.id,
                updated_at: item.updated_at,
                purchased: !item.purchased,
              }),
            )
          }
        >
          {item.purchased && <Check size={17} />}
        </button>
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
              ? formatGrams(item.amount)
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
      <div className="shopping-row-detail">
        {item.required_g !== null && (
          <span>
            Needed <strong>{formatGrams(item.required_g)}</strong>
          </span>
        )}
        {item.pantry_g !== null && (
          <span>
            Usable pantry <strong>{formatGrams(item.pantry_g)}</strong>
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
