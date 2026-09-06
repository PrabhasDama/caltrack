"use client";
import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { savePurchase } from "@/app/(app)/budget/actions";
import { purchaseSubtotal } from "@/lib/budget/calculations";
import { money } from "@/lib/pricing/calculations";
import type { Currency, RetailProduct } from "@/lib/pricing/types";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { Purchase, PurchaseItem } from "@/lib/budget/types";
import { PurchaseItemFields } from "./purchase-item-fields";
export type EditorContext = {
  foods: CatalogFood[];
  products: RetailProduct[];
  stores: { id: string; name: string }[];
  today: string;
  currency: Currency;
  shoppingFoodIds?: string[];
  recentFoodIds?: string[];
  units?: "imperial" | "metric";
};
const blankItem = (): PurchaseItem => ({
  food_id: null,
  retail_product_id: null,
  name: "",
  quantity: 1,
  unit: "package",
  unit_price: 0,
});
export function PurchaseEditor(
  props: EditorContext & { purchase?: Purchase; children: React.ReactNode },
) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.children}</DialogTrigger>
      <DialogContent
        title={
          props.purchase ? "Edit purchase" : "Make room for the real numbers."
        }
        description="Log what you actually paid. Purchase logging does not add pantry stock."
      >
        {open && <PurchaseForm {...props} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
function PurchaseForm({
  purchase,
  foods,
  products,
  stores,
  today,
  currency: initialCurrency,
  shoppingFoodIds = [],
  recentFoodIds = [],
  close,
}: EditorContext & { purchase?: Purchase; close: () => void }) {
  const [id] = useState(() => purchase?.id || crypto.randomUUID());
  const [items, setItems] = useState(() => purchase?.items || [blankItem()]);
  const [storeId, setStoreId] = useState(purchase?.store_id || "");
  const [currency, setCurrency] = useState(
    purchase?.currency || initialCurrency,
  );
  const [total, setTotal] = useState<string | null>(
    purchase ? String(purchase.total) : null,
  );
  const { pending, error, run } = useMutation();
  const subtotal = purchaseSubtotal(items);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            savePurchase({
              id,
              updated_at: purchase?.updated_at,
              store_id: storeId || null,
              store_name:
                stores.find((s) => s.id === storeId)?.name ||
                f.get("store_name"),
              purchased_on: f.get("date"),
              currency,
              total: total === null ? subtotal : Number(total),
              notes: f.get("notes"),
              items,
            }),
          close,
        );
      }}
    >
      {!purchase && (
        <div className="notice">
          <strong>From My Shopping List</strong>
          <p>
            Shopping now? Record items once to update pantry and budget
            together.
          </p>
          <Link className="button" href="/groceries">
            Open my shopping list →
          </Link>
        </div>
      )}
      <div className="form-grid compact-grid">
        <label className="field">
          Store
          <select
            aria-label="Purchase store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">Another store</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {!storeId && (
          <label className="field">
            Store name
            <input
              name="store_name"
              required
              maxLength={120}
              defaultValue={purchase?.store_name || ""}
            />
          </label>
        )}
        <label className="field">
          Purchase date
          <input
            name="date"
            type="date"
            required
            max={today}
            defaultValue={purchase?.purchased_on || today}
          />
        </label>
        <label className="field">
          Currency
          <select
            aria-label="Purchase currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            <option>USD</option>
            <option>CAD</option>
          </select>
        </label>
      </div>
      {items.map((item, index) => (
        <PurchaseItemFields
          key={index}
          item={item}
          index={index}
          foods={foods}
          products={products}
          shoppingFoodIds={shoppingFoodIds}
          recentFoodIds={recentFoodIds}
          onChange={(next) =>
            setItems(items.map((i, n) => (n === index ? next : i)))
          }
          onRemove={() => setItems(items.filter((_, n) => n !== index))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={items.length >= 100}
        onClick={() => setItems([...items, blankItem()])}
      >
        Add purchase item
      </Button>
      <p className="muted">
        Item subtotal: <strong>{money(subtotal, currency)}</strong>
      </p>
      <label className="field">
        Receipt total, including tax
        <input
          aria-label="Receipt total"
          required
          type="number"
          min={subtotal}
          max="1000000"
          step=".01"
          value={total === null ? subtotal : total}
          onChange={(e) => setTotal(e.target.value)}
        />
      </label>
      <label className="field">
        Notes (optional)
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={purchase?.notes || ""}
        />
      </label>
      <p className="fine-print muted">
        Enter price per selected unit: for 2 packages at 3.50 each, use quantity
        2 and price 3.50. Demo package matches describe size only; enter your
        actual receipt price.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <Button disabled={pending || !items.length}>
        {pending ? "Saving…" : "Save purchase"}
      </Button>
    </form>
  );
}
