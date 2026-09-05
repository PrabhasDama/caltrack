"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { addShoppingItem } from "@/app/(app)/groceries/actions";
import { foodUnits } from "@/lib/pantry/units";
import type { CatalogFood } from "@/lib/meal-plan/types";
export function ShoppingEditor({
  foods,
  children,
}: {
  foods: CatalogFood[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [foodId, setFoodId] = useState("");
  const { pending, error, run } = useMutation();
  const food = foods.find((f) => f.id === foodId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title="Something else for your basket?"
        description="Manual additions stay on the list when requirements are recalculated."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                addShoppingItem({
                  food_id: foodId || null,
                  name: food?.name || f.get("name"),
                  amount: Number(f.get("amount")),
                  unit: f.get("unit"),
                }),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Food library (optional)
            <select
              aria-label="Shopping ingredient"
              value={foodId}
              onChange={(e) => setFoodId(e.target.value)}
            >
              <option value="">Enter a custom item</option>
              {foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {!food && (
            <label className="field">
              Item name
              <input
                name="name"
                required
                maxLength={120}
                placeholder="Coffee, paper towels…"
              />
            </label>
          )}
          <div className="form-grid compact-grid">
            <label className="field">
              Amount
              <input
                type="number"
                name="amount"
                min="0.001"
                max="1000000"
                step="any"
                required
              />
            </label>
            <label className="field">
              Unit
              <select name="unit" aria-label="Shopping unit" key={foodId}>
                {(food
                  ? foodUnits(food)
                  : ["piece", "g", "kg", "oz", "lb"]
                ).map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button disabled={pending}>
            {pending ? "Adding…" : "Add to list"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
