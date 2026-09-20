"use client";
import { useMemo, useState } from "react";
import { SplitPlanPanel } from "./split-plan-panel";
import { CartComparison } from "./cart-comparison";
import Link from "next/link";
import { Plus, RefreshCw, ShoppingBasket, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { refreshGroceries } from "@/app/(app)/groceries/actions";
import { addDays } from "@/lib/date";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { ShoppingItem } from "@/lib/groceries/requirements";
import { ShoppingEditor } from "./shopping-editor";
import { SessionPanel } from "./session-panel";
import type { ShoppingContext } from "@/lib/shopping/types";
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
  context,
  units = "metric",
}: {
  foods: CatalogFood[];
  shopping: ShoppingList | null;
  today: string;
  offers?: Record<string, React.ReactNode>;
  context: ShoppingContext;
  units?: "metric" | "imperial";
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
  const [compare, setCompare] = useState(false);
  const [message, setMessage] = useState("");
  const items = useMemo(
    () =>
      [...(shopping?.items || [])]
        .filter(
          (i) =>
            (i.fulfillment || (i.purchased ? "already_have" : "needed")) ===
              "needed" && i.amount > 0,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [shopping],
  );
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
      <SplitPlanPanel
        context={context}
        items={items}
        foods={foods}
        today={today}
        onCompare={() => setCompare(true)}
      />
      {(!context.splits?.length || compare) && (
        <CartComparison
          items={items}
          context={context}
          foods={foods}
          today={today}
          onApplied={() => setCompare(false)}
        />
      )}
      <SessionPanel context={context} today={today} />
      <p className="fine-print">
        <Link href="/stores">
          Find nearby stores and review product matches
        </Link>
        . Missing prices need confirmation; no savings are estimated for an
        incomplete basket.
      </p>
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
          <Button disabled={pending || Boolean(context.session)}>
            <RefreshCw size={14} />{" "}
            {pending ? "Updating…" : "Update from meal plan"}
          </Button>
        </form>
        <p className="fine-print muted">
          Updates automatically as meals and pantry change. Stock is counted
          only for meals before its expiry. Confirmed purchases update pantry
          and spending; “Already have it” does neither.
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
            {items.length} active requirements · purchased items stay in receipt
            history
          </p>
        </div>
      </div>
      {items.length ? (
        <div className="shopping-list card">
          {items.map((item) => (
            <ShoppingRow
              key={`${item.id}-${item.updated_at}`}
              item={item}
              context={context}
              units={units}
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
          Purchased items leave this active list and return when upcoming demand
          exceeds stock. Manual items are preserved.
        </p>
      )}
    </div>
  );
}
