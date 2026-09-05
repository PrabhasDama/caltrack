"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { savePantry } from "@/app/(app)/pantry/actions";
import { foodUnits, gramsToQuantity, type FoodUnit } from "@/lib/pantry/units";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { PantryRecord } from "@/lib/pantry/inventory";
export function PantryEditor({
  foods,
  item,
  children,
}: {
  foods: CatalogFood[];
  item?: PantryRecord;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [foodId, setFoodId] = useState(item?.food_id || "");
  const [unit, setUnit] = useState<FoodUnit>(item?.display_unit || "g");
  const { pending, error, run } = useMutation();
  const food = foods.find((f) => f.id === foodId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={
          item ? "Update your pantry" : "Give your pantry a little structure."
        }
        description="Amounts are stored in grams so meals and groceries use the same quantities."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                savePantry({
                  id: item?.id,
                  updated_at: item?.updated_at,
                  food_id: foodId,
                  quantity: Number(f.get("quantity")),
                  unit,
                  low_threshold_g: Number(f.get("threshold")),
                  purchased_on: f.get("purchased") || null,
                  expires_on: f.get("expires") || null,
                }),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Ingredient
            <select
              required
              aria-label="Pantry ingredient"
              value={foodId}
              disabled={Boolean(item)}
              onChange={(e) => {
                setFoodId(e.target.value);
                setUnit("g");
              }}
            >
              <option value="">Choose a food</option>
              {foods.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {food && (
            <p className="notice">
              {food.preparation}. Keep pantry quantities in this same form for
              accurate deductions.
            </p>
          )}
          <div className="form-grid compact-grid">
            <label className="field">
              Quantity
              <input
                type="number"
                name="quantity"
                required
                min="0"
                max="1000000"
                step="any"
                defaultValue={
                  item
                    ? Number(
                        gramsToQuantity(
                          item.quantity_g,
                          item.display_unit,
                          food,
                        ).toFixed(3),
                      )
                    : ""
                }
              />
            </label>
            <label className="field">
              Unit
              <select
                aria-label="Pantry unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as FoodUnit)}
              >
                {foodUnits(food).map((u) => (
                  <option key={u} value={u}>
                    {u === "piece"
                      ? "pieces (approx.)"
                      : u === "serving"
                        ? "reference servings"
                        : u}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Low-stock threshold (g)
            <input
              type="number"
              name="threshold"
              defaultValue={item?.low_threshold_g ?? food?.serving_g ?? 100}
              min="0"
              max="1000000"
              required
            />
          </label>
          <div className="form-grid compact-grid">
            <label className="field">
              Purchase date (optional)
              <input
                name="purchased"
                type="date"
                defaultValue={item?.purchased_on || ""}
              />
            </label>
            <label className="field">
              Expiration date (optional)
              <input
                name="expires"
                type="date"
                defaultValue={item?.expires_on || ""}
              />
            </label>
          </div>
          <p className="fine-print muted">
            One combined entry per ingredient. If combining batches, use the
            earliest expiration. Cup and volume conversions are omitted when
            density isn’t known.
          </p>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <Button disabled={pending || !food}>
            {pending ? "Saving…" : "Save pantry item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
