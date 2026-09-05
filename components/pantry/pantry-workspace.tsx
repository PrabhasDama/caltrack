"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  PackageOpen,
  ArrowUpRight,
  Trash2,
  Check,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PantryEditor } from "./pantry-editor";
import { useMutation } from "@/components/dashboard/use-mutation";
import { removePantry } from "@/app/(app)/pantry/actions";
import { pantryState, type PantryRecord } from "@/lib/pantry/inventory";
import { formatGrams } from "@/lib/pantry/units";
import type { CatalogFood } from "@/lib/meal-plan/types";
function PantryCard({
  item,
  foods,
  today,
}: {
  item: PantryRecord;
  foods: CatalogFood[];
  today: string;
}) {
  const food = foods.find((f) => f.id === item.food_id);
  const { pending, error, run } = useMutation();
  const [confirm, setConfirm] = useState(false);
  const status = pantryState(item, today);
  return (
    <article className="card pantry-card">
      <div className="section-heading">
        <span className={`pill ${status === "Expired" ? "warn-pill" : ""}`}>
          {status}
        </span>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogTrigger asChild>
            <button
              className="icon-button"
              aria-label={`Remove ${food?.name || "item"}`}
            >
              <Trash2 size={15} />
            </button>
          </DialogTrigger>
          <DialogContent
            title={`Remove ${food?.name || "this ingredient"}?`}
            description="This removes its current pantry quantity. Your meal history is preserved."
          >
            {error && <p className="error-text">{error}</p>}
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    removePantry({
                      id: item.id,
                      updated_at: item.updated_at,
                      deplete: false,
                    }),
                  () => setConfirm(false),
                )
              }
            >
              Remove from pantry
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      <h3>{food?.name || "Ingredient"}</h3>
      <div className="large-value">{formatGrams(item.quantity_g)}</div>
      <p className="muted fine-print">
        {food
          ? `About ${(item.quantity_g / food.serving_g).toFixed(1)} reference servings`
          : "Serving size unavailable"}
      </p>
      <p className="pantry-form-note">{food?.preparation || "As purchased"}</p>
      {item.expires_on && (
        <p className="fine-print muted">Expires {item.expires_on}</p>
      )}
      <div className="pantry-card-actions">
        <PantryEditor key={item.updated_at} foods={foods} item={item}>
          <Button variant="outline">Edit quantity</Button>
        </PantryEditor>
        <button
          className="text-button"
          disabled={pending || item.quantity_g === 0}
          onClick={() =>
            run(() =>
              removePantry({
                id: item.id,
                updated_at: item.updated_at,
                deplete: true,
              }),
            )
          }
        >
          <Check size={13} /> Mark depleted
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
export function PantryWorkspace({
  foods,
  pantry,
  today,
}: {
  foods: CatalogFood[];
  pantry: PantryRecord[];
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const rows = pantry.filter(
    (i) =>
      (foods.find((f) => f.id === i.food_id)?.name || "")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All" || pantryState(i, today) === filter),
  );
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">START WITH WHAT YOU HAVE</span>
          <h1>
            A well-stocked kind of calm<span className="brand-dot">.</span>
          </h1>
          <p>Your ingredients, ready for the week ahead.</p>
        </div>
        <PantryEditor foods={foods}>
          <Button>
            <Plus size={15} /> Add ingredient
          </Button>
        </PantryEditor>
      </header>
      <div className="inventory-summary">
        {["In stock", "Running low", "Depleted", "Expired"].map((status) => (
          <button
            key={status}
            className={`card ${filter === status ? "selected" : ""}`}
            onClick={() => setFilter(filter === status ? "All" : status)}
            aria-pressed={filter === status}
          >
            <span>{status}</span>
            <strong>
              {pantry.filter((i) => pantryState(i, today) === status).length}
            </strong>
          </button>
        ))}
      </div>
      <div className="inventory-tools">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search pantry"
            placeholder="Find an ingredient…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Link className="text-link" href="/groceries">
          Update grocery requirements <ArrowUpRight size={13} />
        </Link>
      </div>
      {rows.length ? (
        <div className="pantry-grid">
          {rows.map((item) => (
            <PantryCard key={item.id} item={item} foods={foods} today={today} />
          ))}
        </div>
      ) : (
        <section className="empty-meals">
          <div className="empty-icon">
            <PackageOpen size={24} />
          </div>
          <div>
            <h3>
              {pantry.length
                ? "No ingredients match this view."
                : "Your pantry starts here."}
            </h3>
            <p>
              {pantry.length
                ? "Try another filter or search."
                : "Add the ingredients you already have. Your grocery list will account for them."}
            </p>
          </div>
        </section>
      )}
      <p className="fine-print muted">
        Completing a meal deducts available, unexpired stock once. Undo restores
        the amount actually used. Update your grocery list after changing
        inventory.
      </p>
    </div>
  );
}
