"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { rankPantryMeals, type PantryMode } from "@/lib/meal-plan/discovery";
import { formatFoodQuantity } from "@/lib/food/quantities";
import { money } from "@/lib/pricing/calculations";
import type {
  PlanContext,
  PlannedMeal,
  MealTemplate,
} from "@/lib/meal-plan/types";
import { RecipeDetails } from "./meal-preview";
export function PantryDiscovery({
  context,
  onChoose,
  locked,
}: {
  context: PlanContext;
  onChoose: (t: MealTemplate, slot: PlannedMeal["slot"]) => void;
  locked: boolean;
}) {
  const [mode, setMode] = useState<PantryMode>("Use Pantry First");
  const [slot, setSlot] = useState<PlannedMeal["slot"]>("Dinner");
  const rows = rankPantryMeals(context, slot, mode);
  return (
    <section className="card pantry-discovery">
      <h2>Cook From My Pantry</h2>
      <p className="muted">
        Use what you have. Suggestions respect your saved dietary and cooking
        preferences.
      </p>
      <label className="field">
        Meal to discover
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value as PlannedMeal["slot"])}
        >
          {["Breakfast", "Lunch", "Dinner", "Snack"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="discovery-filters">
        {(
          [
            "Use Pantry First",
            "Lowest Extra Spend",
            "Best Macro Fit",
            "Use Expiring Ingredients",
          ] as PantryMode[]
        ).map((m) => (
          <button
            type="button"
            key={m}
            aria-pressed={m === mode}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {!context.pantry?.some((p) => p.quantity_g > 0) && (
        <p className="notice">
          Add ingredients to your pantry to improve these recommendations.
        </p>
      )}
      <div className="discovery-results">
        {rows.slice(0, 8).map((r) => (
          <article className="discovery-recipe" key={r.template.id}>
            <h3>{r.template.name}</h3>
            <p>
              <strong>
                Pantry coverage: {Math.round(r.estimate.coverage * 100)}%
              </strong>{" "}
              · {Math.round(r.meal.macros.protein)}g protein ·{" "}
              {Math.round(r.meal.macros.calories)} kcal ·{" "}
              {Math.round(r.meal.macros.carbs)}g carbs ·{" "}
              {Math.round(r.meal.macros.fat)}g fat · {r.meal.cooking_minutes}{" "}
              min
            </p>
            <p className="fine-print">
              Need to buy:{" "}
              {r.estimate.missing.length
                ? r.estimate.missing
                    .map(
                      (i) =>
                        `${i.name} (${formatFoodQuantity(
                          i.grams,
                          context.foods.find((f) => f.id === i.food_id),
                          context.units,
                          true,
                        )})`,
                    )
                    .join(", ")
                : "Nothing"}
            </p>
            <p className="fine-print muted">
              {r.estimate.cost === null
                ? "Additional cost unavailable"
                : `${r.estimate.isDemo ? "Demo pricing" : "Observed prices"} · ${money(r.estimate.cost, r.estimate.currency)} estimated extra package spend`}
              {r.estimate.expiringCoverage > 0
                ? ` · Uses ingredients expiring within 3 days`
                : ""}
            </p>
            <RecipeDetails meal={r.meal} context={context} />
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => onChoose(r.template, slot)}
            >
              Use for {slot.toLowerCase()}
            </Button>
          </article>
        ))}
      </div>
      {!rows.length && (
        <p className="notice">
          No recipes fit this meal slot and your current restrictions.
        </p>
      )}
    </section>
  );
}
