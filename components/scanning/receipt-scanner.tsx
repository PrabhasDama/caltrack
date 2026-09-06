"use client";
import { useState } from "react";
import Link from "next/link";
import { UploadForm } from "@/components/uploads/upload-form";
import { PrivateImage } from "@/components/uploads/private-image";
import { Button } from "@/components/ui/button";
import {
  confirmReceipt,
  extractReceipt,
} from "@/app/(app)/scan/receipt/actions";
import { matchReceiptName } from "@/lib/scanning/review";
import { formatFoodQuantity } from "@/lib/food/quantities";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { UserUpload } from "@/lib/uploads/types";
import type { RetailProduct } from "@/lib/pricing/types";
type Line = {
  name: string;
  quantity: string;
  price: string;
  foodId: string;
  productId: string;
  grams: string;
  shoppingId: string;
};
const blank = (): Line => ({
  name: "",
  quantity: "1",
  price: "",
  foodId: "",
  productId: "",
  grams: "",
  shoppingId: "",
});
export function ReceiptScanner({
  today,
  uploads,
  foods,
  products,
  shopping,
  units,
  currency: initialCurrency,
}: {
  today: string;
  uploads: UserUpload[];
  foods: CatalogFood[];
  products: RetailProduct[];
  shopping: {
    id: string;
    food_id: string;
    name: string;
    amount: number;
    updated_at: string;
  }[];
  units: "metric" | "imperial";
  currency: "USD" | "CAD";
}) {
  const [id, setId] = useState(""),
    [lines, setLines] = useState<Line[]>([blank()]),
    [store, setStore] = useState(""),
    [date, setDate] = useState(today),
    [currency, setCurrency] = useState(initialCurrency),
    [total, setTotal] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  function edit(index: number, patch: Partial<Line>) {
    setConfirmed(false);
    setLines((old) =>
      old.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }
  async function review(next: string) {
    setPending(true);
    setError("");
    setId(next);
    try {
      const r = await extractReceipt(next);
      setSaved(r.saved);
      if (!r.saved) {
        const c = r.extraction.candidate;
        setStore(c?.store || "");
        setDate(c?.date || today);
        setTotal(c?.total?.toString() || "");
        setLines(
          c?.items.length
            ? c.items.map((i) => ({
                ...blank(),
                name: i.name,
                quantity: i.quantity?.toString() || "",
                price: i.price?.toString() || "",
              }))
            : [blank()],
        );
        setMessage(
          r.extraction.status === "unavailable"
            ? r.extraction.message
            : "Candidate values only. Verify every line against the image. Uncertain fields are blank.",
        );
        setConfirmed(false);
      }
    } catch {
      setMessage(
        "Extraction is unavailable. Enter and review the receipt manually.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="secondary-page">
      <header className="page-title">
        <span className="eyebrow">RECEIPT → REVIEW → CONFIRM</span>
        <h1>Bring your receipt into the picture.</h1>
        <p>
          You choose which lines add pantry stock and fulfill groceries. Nothing
          is committed before confirmation.
        </p>
      </header>
      {!id ? (
        <section className="card">
          <h2>Scan Receipt</h2>
          <UploadForm bucket="receipts" today={today} onSaved={review} />
          {uploads.length > 0 && (
            <label className="field">
              Continue a previous receipt
              <select value="" onChange={(e) => void review(e.target.value)}>
                <option value="">Choose an image</option>
                {uploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.local_date} · {u.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      ) : pending && !message ? (
        <p role="status">Preparing review…</p>
      ) : saved ? (
        <section className="card">
          <h2>Receipt confirmed</h2>
          <p>
            Your spending, matched pantry stock, and selected groceries are
            saved. Reopening this image will not add them again.
          </p>
          <Link href="/budget" className="button">
            View budget
          </Link>{" "}
          <Link href="/groceries" className="button">
            Corrections and undo
          </Link>
        </section>
      ) : (
        <section className="card scan-review">
          <div>
            <h2>Review your receipt</h2>
            <PrivateImage id={id} alt="Receipt being reviewed" />
            <p className="notice">{message}</p>
            <p className="fine-print">
              Leave pantry matching blank without a reliable food or weight
              match. Include tax as a spending-only line; enter item prices
              after discounts.
            </p>
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              try {
                const r = await confirmReceipt(id, {
                  store,
                  date,
                  currency,
                  total: Number(total),
                  confirmed,
                  items: lines.map((l) => ({
                    ...l,
                    quantity: Number(l.quantity),
                    price: Number(l.price),
                    foodId: l.foodId || null,
                    productId: l.productId || null,
                    grams: l.grams ? Number(l.grams) : null,
                    shoppingId: l.shoppingId || null,
                    expected:
                      shopping.find((s) => s.id === l.shoppingId)?.updated_at ||
                      null,
                  })),
                });
                if (r.error) setError(r.error);
                else setSaved(true);
              } catch {
                setError(
                  "Could not confirm. Your review is still here; retry safely.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field">
              Store
              <input
                required
                maxLength={120}
                value={store}
                onChange={(e) => {
                  setStore(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="field">
              Purchase date
              <input
                required
                type="date"
                max={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="field">
              Currency
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value as "USD" | "CAD");
                  setConfirmed(false);
                }}
              >
                <option>USD</option>
                <option>CAD</option>
              </select>
            </label>
            {lines.map((l, i) => {
              const food = foods.find((f) => f.id === l.foodId);
              const matches = matchReceiptName(
                l.name,
                foods,
                products,
                shopping.map((s) => s.food_id),
              ).slice(0, 3);
              return (
                <fieldset className="receipt-review-line form-stack" key={i}>
                  <legend>Line {i + 1}</legend>
                  <label className="field">
                    Item name
                    <input
                      required
                      maxLength={120}
                      value={l.name}
                      onChange={(e) => edit(i, { name: e.target.value })}
                    />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      Purchased units
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          edit(i, { quantity: e.target.value, productId: "" })
                        }
                      />
                    </label>
                    <label className="field">
                      Price per unit ({currency})
                      <input
                        required
                        type="number"
                        min="0"
                        step=".01"
                        value={l.price}
                        onChange={(e) => edit(i, { price: e.target.value })}
                      />
                    </label>
                  </div>
                  {!!matches.length && (
                    <p className="fine-print">
                      Possible matches:{" "}
                      {matches.map((m) => m.food.name).join(", ")}. Choose below
                      to add stock.
                    </p>
                  )}
                  <label className="field">
                    Pantry food
                    <select
                      value={l.foodId}
                      onChange={(e) =>
                        edit(i, {
                          foodId: e.target.value,
                          productId: "",
                          grams: "",
                          shoppingId: "",
                        })
                      }
                    >
                      <option value="">Spending only · no pantry match</option>
                      {foods.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {food && (
                    <>
                      <label className="field">
                        Retail package (optional)
                        <select
                          value={l.productId}
                          onChange={(e) => {
                            const p = products.find(
                              (p) => p.id === e.target.value,
                            );
                            edit(i, {
                              productId: e.target.value,
                              grams: p?.package_grams
                                ? String(p.package_grams * Number(l.quantity))
                                : l.grams,
                            });
                          }}
                        >
                          <option value="">No verified package match</option>
                          {products
                            .filter((p) => p.food_id === l.foodId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.package_label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="field">
                        Total food weight (g)
                        <input
                          required
                          type="number"
                          min=".001"
                          step="any"
                          value={l.grams}
                          onChange={(e) =>
                            edit(i, { grams: e.target.value, productId: "" })
                          }
                        />
                      </label>
                      {Number(l.grams) > 0 && (
                        <p>
                          {formatFoodQuantity(Number(l.grams), food, units)}{" "}
                          added to pantry
                        </p>
                      )}
                      <label className="field">
                        Fulfill a grocery requirement (optional)
                        <select
                          value={l.shoppingId}
                          onChange={(e) =>
                            edit(i, { shoppingId: e.target.value })
                          }
                        >
                          <option value="">Leave groceries unchanged</option>
                          {shopping
                            .filter((s) => s.food_id === l.foodId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ·{" "}
                                {formatFoodQuantity(
                                  Number(s.amount),
                                  food,
                                  units,
                                  true,
                                )}
                              </option>
                            ))}
                        </select>
                      </label>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={lines.length === 1 || pending}
                    onClick={() => {
                      setLines(lines.filter((_, n) => n !== i));
                      setConfirmed(false);
                    }}
                  >
                    Remove line {i + 1}
                  </Button>
                </fieldset>
              );
            })}
            <Button
              type="button"
              variant="outline"
              disabled={pending || lines.length >= 100}
              onClick={() => {
                setLines([...lines, blank()]);
                setConfirmed(false);
              }}
            >
              Add receipt line
            </Button>
            <p>
              Reviewed lines:{" "}
              {lines
                .reduce(
                  (n, l) =>
                    n +
                    Math.round(Number(l.quantity) * Number(l.price) * 100) /
                      100,
                  0,
                )
                .toFixed(2)}{" "}
              {currency}
            </p>
            <label className="field">
              Receipt total ({currency})
              <input
                required
                type="number"
                min="0"
                step=".01"
                value={total}
                onChange={(e) => {
                  setTotal(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="review-confirm">
              <input
                required
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed every line, weight, match and total. Confirm this
              purchase once.
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <Button disabled={pending}>
              {pending ? "Confirming…" : "Confirm receipt"}
            </Button>
          </form>
        </section>
      )}
      <Link href="/budget" className="text-link">
        Back to Budget →
      </Link>
    </div>
  );
}
