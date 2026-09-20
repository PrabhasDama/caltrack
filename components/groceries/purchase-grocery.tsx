"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { buySplitAssignment } from "@/app/(app)/groceries/split-actions";
import { PriceDisplay } from "./price-display";
import type { SplitAssignment } from "@/lib/shopping/splits";
import { purchaseGrocery } from "@/app/(app)/groceries/session-actions";
import { money } from "@/lib/pricing/calculations";
import { smallestSingle } from "@/lib/shopping/packages";
import { formatFoodQuantity } from "@/lib/food/quantities";
import { formatPackage } from "@/lib/shopping/display";
import { quantityToGrams, foodUnits, type FoodUnit } from "@/lib/pantry/units";
import type { ShoppingContext } from "@/lib/shopping/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
import type { CatalogFood } from "@/lib/meal-plan/types";
export function PurchaseGrocery(props: {
  context: ShoppingContext;
  item: ShoppingItem;
  food?: CatalogFood;
  assignment?: SplitAssignment;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={!props.context.session}
          title={
            !props.context.session
              ? "Start shopping to record a purchase"
              : undefined
          }
        >
          Purchase
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Purchase ${props.item.name}`}
        description="Review the quantity and price before confirming. Known food weight goes into pantry; the receipt updates your budget."
      >
        {open && <PurchaseForm {...props} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
function PurchaseForm({
  context,
  item,
  food,
  assignment,
  close,
}: {
  context: ShoppingContext;
  item: ShoppingItem;
  food?: CatalogFood;
  assignment?: SplitAssignment;
  close: () => void;
}) {
  const session = context.session!;
  const products = context.products.filter(
    (p) => p.food_id === item.food_id && item.food_id,
  );
  const assigned =
    assignment && products.find((p) => p.id === assignment.product_id);
  const suggestion = assignment
    ? assigned
      ? { product: assigned, quantity: assignment.package_count }
      : undefined
    : smallestSingle(item.amount, products)?.packages[0];
  const [request] = useState(() => crypto.randomUUID());
  const [productId, setProduct] = useState(suggestion?.product.id || "");
  const [quantity, setQuantity] = useState(
    suggestion?.quantity || Math.max(assignment?.allocated_g || item.amount, 1),
  );
  const [unit, setUnit] = useState(
    suggestion ? "package" : assignment ? "g" : item.unit,
  );
  const [price, setPrice] = useState("");
  const [source, setSource] = useState<"manual" | "demo">("manual");
  const { pending, error, run } = useMutation();
  const product = products.find((p) => p.id === productId);
  const offer = context.offers.find(
    (o) =>
      o.product.id === productId &&
      o.location.id === session.location_id &&
      o.currency === session.receipt.currency,
  );
  let grams: number | null = null;
  try {
    grams =
      unit === "package"
        ? product?.package_grams
          ? product.package_grams * quantity
          : null
        : food
          ? quantityToGrams(quantity, unit as FoodUnit, food)
          : null;
  } catch {}
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            assignment
              ? buySplitAssignment({
                  assignment: assignment.id,
                  request,
                  session: session.id,
                  expected: item.updated_at,
                  product: productId || null,
                  quantity,
                  unit,
                  price: Number(price),
                  expires: f.get("expires") || null,
                })
              : purchaseGrocery({
                  request,
                  session: session.id,
                  item: item.id,
                  expected: item.updated_at,
                  product: productId || null,
                  offer: source === "demo" ? offer?.id || null : null,
                  quantity,
                  unit,
                  price: Number(price),
                  priceSource: source,
                  expires: f.get("expires") || null,
                }),
          close,
        );
      }}
    >
      {assignment && (
        <p className="notice">
          Saved recommendation: {assignment.package_count} ×{" "}
          {assignment.product_name}. Expected{" "}
          {money(assignment.expected_unit_price, session.receipt.currency)}{" "}
          each. If unavailable, choose a matching alternative or enter the
          actual food weight. The original recommendation stays in history.
        </p>
      )}
      <label className="field">
        Product or loose food
        <select
          aria-label="Purchased product"
          value={productId}
          onChange={(e) => {
            setProduct(e.target.value);
            setSource("manual");
            setPrice("");
            const p = products.find((p) => p.id === e.target.value);
            setUnit(p ? "package" : item.unit);
            setQuantity(
              p?.package_grams
                ? Math.max(
                    1,
                    Math.ceil(
                      (assignment?.allocated_g || item.amount) /
                        p.package_grams,
                    ),
                  )
                : Math.max(assignment?.allocated_g || item.amount, 1),
            );
          }}
        >
          <option value="">Loose / enter weight or natural quantity</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatPackage(p, food, context.units)}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid compact-grid">
        <label className="field">
          Purchased quantity
          <input
            aria-label="Purchased quantity"
            type="number"
            required
            min={unit === "piece" || unit === "package" ? "1" : ".001"}
            max="1000000"
            step={unit === "piece" || unit === "package" ? "1" : "any"}
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Unit
          <select
            aria-label="Purchased unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as typeof unit)}
          >
            {(product
              ? ["package", ...foodUnits(food)]
              : food
                ? foodUnits(food)
                : ["piece", "g", "kg", "oz", "lb"]
            ).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      {grams !== null && (
        <p className="notice">
          Adds {formatFoodQuantity(grams, food, context.units)} to pantry
          {item.unit === "g"
            ? ` · ${formatFoodQuantity(Math.max(0, grams - item.amount), food, context.units)} beyond this shopping requirement`
            : ""}
          . All purchased stock, including leftovers, is retained.
        </p>
      )}
      {food && !grams && (
        <p className="error-text">
          Choose a unit with a known weight before saving.
        </p>
      )}
      <label className="field">
        Price per {unit} ({session.receipt.currency})
        <input
          aria-label="Purchase unit price"
          required
          type="number"
          min="0"
          max="1000000"
          step=".01"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setSource("manual");
          }}
        />
      </label>
      {!assignment && offer?.is_demo && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPrice(String(offer.price));
            setSource("demo");
            setUnit("package");
          }}
        >
          Use Demo pricing: {money(offer.price, offer.currency)} / package
        </Button>
      )}
      {offer && !offer.is_demo && (
        <p className="fine-print">
          <PriceDisplay
            value={{
              price: offer.price,
              currency: offer.currency,
              source: offer.source,
              observedAt: offer.observed_at,
              environment:
                offer.source === "provider" ? offer.environment : undefined,
              regularPrice: offer.regular_price,
            }}
          />{" "}
          / package. Enter the price you pay today.
        </p>
      )}
      <p className="notice">
        {source === "demo"
          ? `Demo pricing · simulated estimate observed ${offer?.observed_at.slice(0, 10)}. This is not today's retailer price. Correct it from your receipt later.`
          : "Your manually entered receipt price."}{" "}
        Total:{" "}
        {price === ""
          ? "Price needs confirmation"
          : money(quantity * Number(price), session.receipt.currency)}
      </p>
      {food && (
        <label className="field">
          Expiration (optional)
          <input
            name="expires"
            type="date"
            min={session.receipt.purchased_on}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <Button disabled={pending || price === "" || Boolean(food && !grams)}>
        {pending ? "Recording…" : "Confirm purchase"}
      </Button>
    </form>
  );
}
