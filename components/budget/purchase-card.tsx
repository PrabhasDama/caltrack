"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMutation } from "@/components/dashboard/use-mutation";
import { deletePurchase } from "@/app/(app)/budget/actions";
import { lineTotal } from "@/lib/budget/calculations";
import { money, unitPrices } from "@/lib/pricing/calculations";
import { quantityToGrams } from "@/lib/pantry/units";
import { formatFoodQuantity } from "@/lib/food/quantities";
import type { Purchase } from "@/lib/budget/types";
import { PurchaseEditor, type EditorContext } from "./purchase-editor";
export function PurchaseCard({
  purchase,
  context,
}: {
  purchase: Purchase;
  context: EditorContext;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useMutation();
  return (
    <article className="card purchase-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{purchase.purchased_on}</span>
          <h3>{purchase.store_name}</h3>
        </div>
        <strong>{money(purchase.total, purchase.currency)}</strong>
      </div>
      <details>
        <summary>{purchase.items.length} items · View receipt</summary>
        <ul className="receipt-items">
          {purchase.items.map((item, index) => {
            const food = context.foods.find((f) => f.id === item.food_id);
            const product = context.products.find(
              (p) => p.id === item.retail_product_id,
            );
            let grams: number | null = null;
            try {
              grams =
                item.unit === "package"
                  ? product?.package_grams
                    ? product.package_grams * item.quantity
                    : null
                  : quantityToGrams(item.quantity, item.unit, food);
            } catch {}
            const prices = unitPrices(
              lineTotal(item.quantity, item.unit_price),
              grams,
              food?.serving_g,
              food?.nutrition,
            );
            return (
              <li key={index}>
                <div>
                  <strong>
                    {item.name}
                    {item.price_source === "demo" && (
                      <small className="pill">Demo pricing · estimated</small>
                    )}
                  </strong>
                  <span>
                    {item.quantity} {item.unit} ×{" "}
                    {money(item.unit_price, purchase.currency)}
                  </span>
                  {grams !== null && (
                    <small>
                      {formatFoodQuantity(grams, food, context.units)}
                    </small>
                  )}
                </div>
                {prices && food && (
                  <p className="fine-print muted">
                    {prices.perServing !== null &&
                      `${money(prices.perServing, purchase.currency)} / reference serving · `}
                    {prices.per100Calories !== null &&
                      `${money(prices.per100Calories, purchase.currency)} / 100 kcal · `}
                    {prices.per25gProtein !== null &&
                      `${money(prices.per25gProtein, purchase.currency)} / 25 g protein`}
                    <br />
                    Based on item price before receipt taxes and the food
                    reference values.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {purchase.notes && <p>{purchase.notes}</p>}
      </details>
      {purchase.origin !== "manual" ? (
        <Link className="button" href="/groceries">
          Shopping receipt · corrections & reversal →
        </Link>
      ) : (
        <div className="purchase-actions">
          <PurchaseEditor {...context} purchase={purchase}>
            <Button variant="outline">Edit purchase</Button>
          </PurchaseEditor>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost">Delete purchase</Button>
            </DialogTrigger>
            <DialogContent
              title="Delete this purchase?"
              description="The receipt and its items will be removed from your spending history."
            >
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => deletePurchase(purchase),
                    () => setOpen(false),
                  )
                }
              >
                Delete receipt
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </article>
  );
}
