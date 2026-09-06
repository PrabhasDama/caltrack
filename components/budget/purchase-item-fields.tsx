"use client";
import { useState } from "react";
import type { PurchaseItem } from "@/lib/budget/types";
import type { CatalogFood } from "@/lib/meal-plan/types";
import type { RetailProduct } from "@/lib/pricing/types";
export function PurchaseItemFields({
  item,
  index,
  foods,
  products,
  onChange,
  onRemove,
  shoppingFoodIds = [],
  recentFoodIds = [],
}: {
  item: PurchaseItem;
  index: number;
  foods: CatalogFood[];
  products: RetailProduct[];
  onChange: (item: PurchaseItem) => void;
  onRemove: () => void;
  shoppingFoodIds?: string[];
  recentFoodIds?: string[];
}) {
  const [scope, setScope] = useState("shopping");
  const [search, setSearch] = useState("");
  const ids = scope === "shopping" ? shoppingFoodIds : recentFoodIds;
  const shownFoods = foods.filter(
    (f) =>
      (scope === "other" || ids.includes(f.id) || f.id === item.food_id) &&
      f.name.toLowerCase().includes(search.toLowerCase()),
  );
  const shownProducts = products.filter(
    (p) =>
      (p.is_active !== false || p.id === item.retail_product_id) &&
      shownFoods.some((f) => f.id === p.food_id),
  );
  return (
    <fieldset className="purchase-item-fields">
      <legend>Item {index + 1}</legend>
      <label className="field">
        Find purchase items
        <select
          aria-label={`Item ${index + 1} source`}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="shopping">From My Shopping List</option>
          <option value="recent">Recent / Planned Groceries</option>
          <option value="other">Add Something Else</option>
        </select>
      </label>
      {scope === "other" && (
        <label className="field">
          Search catalog
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      )}
      <label className="field">
        Match item
        <select
          aria-label={`Match item ${index + 1}`}
          value={
            item.retail_product_id
              ? `product:${item.retail_product_id}`
              : item.food_id
                ? `food:${item.food_id}`
                : ""
          }
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":");
            const product = products.find((p) => p.id === id);
            const food = foods.find((f) => f.id === id);
            onChange({
              ...item,
              retail_product_id: kind === "product" ? id : null,
              food_id:
                kind === "product"
                  ? product?.food_id || null
                  : kind === "food"
                    ? id
                    : null,
              name: product?.name || food?.name || item.name,
              unit: kind === "product" ? "package" : item.unit,
            });
          }}
        >
          <option value="">Manual / unmatched</option>
          <optgroup label="Demo retail packages">
            {shownProducts.map((p) => (
              <option key={p.id} value={`product:${p.id}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Foods / loose quantities">
            {shownFoods.map((f) => (
              <option key={f.id} value={`food:${f.id}`}>
                {f.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="field">
        Item name
        <input
          aria-label={`Item ${index + 1} name`}
          required
          maxLength={120}
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
        />
      </label>
      <div className="form-grid compact-grid">
        <label className="field">
          Quantity
          <input
            aria-label={`Item ${index + 1} quantity`}
            required
            type="number"
            min={
              item.unit === "piece" || item.unit === "package" ? "1" : "0.001"
            }
            max="1000000"
            step={
              item.unit === "piece" || item.unit === "package" ? "1" : "any"
            }
            value={item.quantity || ""}
            onChange={(e) =>
              onChange({ ...item, quantity: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          Unit
          <select
            aria-label={`Item ${index + 1} unit`}
            value={item.unit}
            onChange={(e) =>
              onChange({
                ...item,
                unit: e.target.value as PurchaseItem["unit"],
              })
            }
          >
            {["g", "kg", "oz", "lb", "piece", "serving", "package"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Price per unit
          <input
            aria-label={`Item ${index + 1} price`}
            required
            type="number"
            min="0"
            max="1000000"
            step=".01"
            value={item.unit_price}
            onChange={(e) =>
              onChange({ ...item, unit_price: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <button type="button" className="text-button" onClick={onRemove}>
        Remove item {index + 1}
      </button>
    </fieldset>
  );
}
