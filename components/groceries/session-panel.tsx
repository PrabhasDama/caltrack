"use client";
import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import {
  startShopping,
  finishShopping,
  undoGroceryPurchase,
  correctGroceryPrice,
} from "@/app/(app)/groceries/session-actions";
import { money } from "@/lib/pricing/calculations";
import type { ShoppingContext, ShoppingEvent } from "@/lib/shopping/types";
export function EventControls({ event }: { event: ShoppingEvent }) {
  const [open, setOpen] = useState<"undo" | "price" | null>(null);
  const { pending, error, run } = useMutation();
  return (
    <>
      <div className="purchase-actions">
        <Button variant="ghost" onClick={() => setOpen("price")}>
          Correct price
        </Button>
        <Button variant="ghost" onClick={() => setOpen("undo")}>
          Undo purchase
        </Button>
      </div>
      <Dialog
        open={Boolean(open)}
        onOpenChange={(v) => {
          if (!v) setOpen(null);
        }}
      >
        <DialogContent
          title={
            open === "undo"
              ? "Reverse this purchase?"
              : "Use the actual receipt price"
          }
          description={
            open === "undo"
              ? "This removes its receipt spending and the stock actually added. If that stock has been used, undo the related meal first."
              : "Price corrections update spending without changing pantry quantities. The source becomes your manually entered receipt price."
          }
        >
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {open === "undo" ? (
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => undoGroceryPurchase(event.id),
                  () => setOpen(null),
                )
              }
            >
              Reverse purchase
            </Button>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(
                  () =>
                    correctGroceryPrice({
                      id: event.id,
                      price: Number(f.get("price")),
                    }),
                  () => setOpen(null),
                );
              }}
            >
              <label className="field">
                Price per {event.line.unit}
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="1000000"
                  step=".01"
                  required
                  defaultValue={event.line.unit_price}
                />
              </label>
              <Button disabled={pending}>Save corrected price</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SessionPanel({
  context,
  today,
}: {
  context: ShoppingContext;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useMutation();
  const session = context.session;
  return (
    <section className="card session-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SHOPPING → PANTRY → BUDGET</span>
          <h2>
            {session
              ? `Shopping at ${session.receipt.store_name}`
              : "Ready to shop?"}
          </h2>
          <p className="muted">
            {session
              ? `${money(session.receipt.total, session.receipt.currency)} running total · ${session.receipt.purchased_on}`
              : "Choose your store, then confirm each purchase to stock your pantry and update spending."}
          </p>
        </div>
        {session ? (
          <Button
            disabled={pending}
            onClick={() => run(() => finishShopping(session.id))}
          >
            Finish shopping
          </Button>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Start shopping</Button>
            </DialogTrigger>
            <DialogContent
              title="Where are you shopping?"
              description="Record purchases at your chosen store. Illustrative locations and prices remain labeled as demo data."
            >
              {open && (
                <StartForm
                  context={context}
                  today={today}
                  close={() => setOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {session && (
        <p className="fine-print muted">
          Confirm prices from your receipt or explicitly select Demo pricing.
          “Already have it” creates no purchase or pantry addition.
        </p>
      )}
      <details className="session-history">
        <summary>Shopping receipts & corrections</summary>
        {[...(session ? [session] : []), ...context.recentSessions].map((s) => (
          <article key={s.id}>
            <div className="section-heading">
              <strong>
                {s.receipt.store_name} ·{" "}
                {s.status === "open" ? "In progress" : "Finished"}
              </strong>
              <span>{money(s.receipt.total, s.receipt.currency)}</span>
            </div>
            {s.events
              .filter((e) => e.state === "purchased")
              .map((e) => (
                <div key={e.id} className="session-line">
                  <span>
                    {e.line.name} · {e.line.quantity} {e.line.unit} ×{" "}
                    {money(e.line.unit_price, s.receipt.currency)}{" "}
                    {e.line.price_source === "demo"
                      ? "· Demo pricing (estimated)"
                      : "· Receipt price"}
                  </span>
                  <EventControls event={e} />
                </div>
              ))}
          </article>
        ))}
        <Link href="/budget" className="text-link">
          View all purchase history →
        </Link>
      </details>
    </section>
  );
}
function StartForm({
  context,
  today,
  close,
}: {
  context: ShoppingContext;
  today: string;
  close: () => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [store, setStore] = useState(context.stores[0]?.id || "");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState(context.currency);
  const { pending, error, run } = useMutation();
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            startShopping({
              id,
              store: store || null,
              location: location || null,
              name:
                context.stores.find((s) => s.id === store)?.name ||
                f.get("name"),
              currency,
              date: f.get("date"),
            }),
          close,
        );
      }}
    >
      <label className="field">
        Store
        <select
          aria-label="Shopping store"
          value={store}
          onChange={(e) => {
            setStore(e.target.value);
            setLocation("");
          }}
        >
          <option value="">Another store</option>
          {context.stores.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {!store && (
        <label className="field">
          Store name
          <input name="name" required maxLength={120} />
        </label>
      )}
      <label className="field">
        Currency
        <select
          aria-label="Shopping currency"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value as "USD" | "CAD");
            setLocation("");
          }}
        >
          <option>USD</option>
          <option>CAD</option>
        </select>
      </label>
      <label className="field">
        Location
        <select
          aria-label="Shopping location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          <option value="">My store · enter receipt prices</option>
          {context.locations
            .filter((l) => l.store_id === store && l.currency === currency)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.is_demo ? " · Demo pricing" : ""}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Purchase date
        <input
          name="date"
          type="date"
          max={today}
          defaultValue={today}
          required
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <Button disabled={pending}>Start this shopping trip</Button>
    </form>
  );
}
