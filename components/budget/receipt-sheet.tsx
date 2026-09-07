"use client";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventControls } from "@/components/groceries/session-panel";
import { money } from "@/lib/pricing/calculations";
import { formatFoodQuantity } from "@/lib/food/quantities";
import type { Purchase } from "@/lib/budget/types";
import type { EditorContext } from "./purchase-editor";
export function ReceiptSheet({
  purchase: p,
  context,
}: {
  purchase: Purchase;
  context: EditorContext;
}) {
  const subtotal = p.items
    .filter((i) => !i.voided_at)
    .reduce((s, i) => s + Math.round(i.quantity * i.unit_price * 100) / 100, 0);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          {p.origin === "manual"
            ? "View receipt"
            : "Shopping receipt · view and correct"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`${p.store_name} receipt`}
        description={`Purchased ${p.purchased_on} · ${p.currency}`}
      >
        <ul className="receipt-items">
          {p.items.map((i, n) => (
            <li key={i.id || n}>
              <div>
                <strong>
                  {i.name}
                  {i.voided_at ? " · reversed" : ""}
                </strong>
                <p>
                  {i.quantity} {i.unit} × {money(i.unit_price, p.currency)} ={" "}
                  {money(i.quantity * i.unit_price, p.currency)}
                </p>
                {i.quantity_g && (
                  <p>
                    {formatFoodQuantity(
                      i.quantity_g,
                      context.foods.find((f) => f.id === i.food_id),
                      context.units,
                    )}
                  </p>
                )}
                <small>
                  {i.price_source === "demo"
                    ? "Demo pricing · simulated"
                    : i.price_source === "provider"
                      ? "Provider observation"
                      : "Receipt / manual price"}
                </small>
                {i.shopping_fulfillments
                  ?.filter((e) => e.state === "purchased")
                  .map((e) => (
                    <EventControls
                      key={e.id}
                      event={{
                        ...e,
                        line: {
                          ...i,
                          price_source: i.price_source || "manual",
                        },
                      }}
                    />
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <p>Line subtotal: {money(subtotal, p.currency)}</p>
        <p className="fine-print muted">
          Tax and discounts are shown as receipt lines when entered. Unrecorded
          adjustments are not inferred.
        </p>
        {Math.abs(p.total - subtotal) > 0.005 && (
          <p>
            Other receipt adjustments: {money(p.total - subtotal, p.currency)}
          </p>
        )}
        <h3>Total: {money(p.total, p.currency)}</h3>
        {p.notes && <p>{p.notes}</p>}
        <Link href="/groceries" className="text-link">
          Open shopping details →
        </Link>
      </DialogContent>
    </Dialog>
  );
}
