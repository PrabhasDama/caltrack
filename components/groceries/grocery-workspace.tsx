"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  ShoppingBasket,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMutation } from "@/components/dashboard/use-mutation";
import {
  refreshGroceries,
  clearPurchased,
} from "@/app/(app)/groceries/actions";
import { addDays } from "@/lib/date";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
import { ShoppingEditor } from "./shopping-editor";
import { ShoppingRow } from "./shopping-row";
export type ShoppingList = {
  id: string;
  start_date: string;
  end_date: string;
  updated_at: string;
  items: ShoppingItem[];
};
export function GroceryWorkspace({
  foods,
  shopping,
  today,
  offers = {},
}: {
  foods: CatalogFood[];
  shopping: ShoppingList | null;
  today: string;
  offers?: Record<string, React.ReactNode>;
}) {
  const { pending, error, run } = useMutation();
  const [start, setStart] = useState(
    shopping?.start_date && shopping.start_date >= today
      ? shopping.start_date
      : today,
  );
  const [end, setEnd] = useState(
    shopping?.end_date && shopping.end_date >= today
      ? shopping.end_date
      : addDays(today, 6),
  );
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const items = [...(shopping?.items || [])].sort(
    (a, b) =>
      Number(a.purchased) - Number(b.purchased) || a.name.localeCompare(b.name),
  );
  const checked = items.filter((i) => i.purchased);
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">ONLY WHAT YOUR WEEK NEEDS</span>
          <h1>
            A smarter kind of shopping list<span className="brand-dot">.</span>
          </h1>
          <p>Your planned ingredients, with your pantry taken into account.</p>
        </div>
        <ShoppingEditor foods={foods}>
          <Button>
            <Plus size={15} /> Add item
          </Button>
        </ShoppingEditor>
      </header>
      <section className="card grocery-controls">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => refreshGroceries({ start, end }),
              () =>
                setMessage(
                  "Requirements updated from saved meals and usable pantry stock.",
                ),
            );
          }}
        >
          <div className="form-grid compact-grid">
            <label className="field">
              Shopping from
              <input
                type="date"
                value={start}
                min={today}
                max={addDays(today, 30)}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Through
              <input
                type="date"
                value={end}
                min={start}
                max={addDays(today, 30)}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </label>
          </div>
          <Button disabled={pending}>
            <RefreshCw size={14} />{" "}
            {pending ? "Updating…" : "Update from meal plan"}
          </Button>
        </form>
        <p className="fine-print muted">
          Includes uneaten meals in this period. Stock expiring before the
          period ends is conservatively excluded. Checking an item off does not
          change pantry stock or log spending.
        </p>
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="section-heading">
        <div>
          <h2>Your basket</h2>
          <p className="muted">
            {items.filter((i) => i.amount > 0 && !i.purchased).length} to buy ·{" "}
            {checked.length} checked ·{" "}
            {items.filter((i) => i.amount === 0).length} stocked
          </p>
        </div>
        {checked.length > 0 && (
          <Dialog open={confirm} onOpenChange={setConfirm}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Check size={14} /> Clear checked
              </Button>
            </DialogTrigger>
            <DialogContent
              title={`Clear ${checked.length} checked items?`}
              description="Only the currently checked items will be removed. Other items and your pantry stay as they are."
            >
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => clearPurchased(checked.map((i) => i.id)),
                    () => setConfirm(false),
                  )
                }
              >
                Clear checked items
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {items.length ? (
        <div className="shopping-list card">
          {items.map((item) => (
            <ShoppingRow
              key={`${item.id}-${item.updated_at}`}
              item={item}
              food={foods.find((f) => f.id === item.food_id)}
              offer={item.food_id ? offers[item.food_id] : undefined}
            />
          ))}
        </div>
      ) : (
        <section className="empty-meals">
          <div className="empty-icon">
            <ShoppingBasket size={25} />
          </div>
          <div>
            <h3>Your next shop starts with a plan.</h3>
            <p>
              Save a meal plan, then update this list. You can also add items
              yourself.
            </p>
          </div>
          <Link href="/plan" className="button">
            Make a meal plan <ArrowUpRight size={14} />
          </Link>
        </section>
      )}
      <div className="plan-next">
        <Link href="/pantry" className="button">
          Manage pantry <ArrowUpRight size={14} />
        </Link>
        <Link href="/budget" className="button">
          Log a purchase <ArrowUpRight size={14} />
        </Link>
      </div>
      {shopping && (
        <p className="fine-print muted">
          List period: {shopping.start_date} through {shopping.end_date}.
          Recalculate after changing meals or pantry quantities. Manual items
          are preserved; generated amount edits are recalculated.
        </p>
      )}
    </div>
  );
}
