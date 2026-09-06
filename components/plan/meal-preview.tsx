"use client";
import { useState } from "react";
import Link from "next/link";
import { Clock, ArrowLeftRight, Check } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { targetDelta } from "@/lib/meal-plan/calculations";
import { rankSwaps, type SwapMode } from "@/lib/meal-plan/discovery";
import { formatFoodQuantity } from "@/lib/food/quantities";
import { money } from "@/lib/pricing/calculations";
import type {
  PlanContext,
  PlannedMeal,
  MealTemplate,
} from "@/lib/meal-plan/types";
export function RecipeDetails({
  meal,
  context,
}: {
  meal: PlannedMeal;
  context: PlanContext;
}) {
  const recipe = context.templates.find(
    (t) => t.id === meal.template_id,
  )?.recipe;
  return (
    <details>
      <summary>Preparation & instructions</summary>
      {recipe && (
        <>
          <p className="fine-print">
            Prep {recipe.prep_minutes} min · Cook {recipe.cook_minutes} min ·
            Total {meal.cooking_minutes} min
            <br />
            {
              ["", "Beginner", "Comfortable", "Confident"][
                context.templates.find((t) => t.id === meal.template_id)
                  ?.complexity || 1
              ]
            }{" "}
            · {recipe.cuisine} · 1 personalized portion (base recipe:{" "}
            {recipe.servings} serving)
          </p>
          <p className="muted fine-print">{recipe.notes}</p>
          <p className="fine-print">
            Optional seasonings: {recipe.seasonings.join(", ")}. Additional
            sauces, oils and toppings need separate tracking.
          </p>
        </>
      )}
      <ol>
        {meal.instructions.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
      <p className="fine-print muted">
        Ingredient form:{" "}
        {meal.ingredients
          .map(
            (i) =>
              `${i.name} — ${context.foods.find((f) => f.id === i.food_id)?.preparation}`,
          )
          .join("; ")}
      </p>
    </details>
  );
}
export function MealPreview({
  meal,
  context,
  onSwap,
  locked,
}: {
  meal: PlannedMeal;
  context: PlanContext;
  onSwap: (template: MealTemplate) => void;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SwapMode>("Recommended");
  const [search, setSearch] = useState("");
  const candidates = rankSwaps(context, meal, mode, search);
  return (
    <article className="plan-meal card">
      <div className="section-heading">
        <span className="eyebrow">{meal.slot}</span>
        {meal.status === "completed" ? (
          <span className="pill">
            <Check size={12} /> Eaten
          </span>
        ) : (
          <span className="muted">
            <Clock size={12} /> {meal.cooking_minutes} min
          </span>
        )}
      </div>
      <h3>{meal.name}</h3>
      <div className="plan-meal-numbers">
        <strong>
          {Math.round(meal.macros.calories)} <small>kcal</small>
        </strong>
        <span>{Math.round(meal.macros.protein)}g protein</span>
        <span>{Math.round(meal.macros.fiber)}g fiber</span>
      </div>
      <p className="fine-print muted">
        {Math.round(meal.macros.carbs)}g carbs · {Math.round(meal.macros.fat)}g
        fat
      </p>
      <ul className="ingredient-list">
        {meal.ingredients.map((i) => (
          <li key={i.food_id}>
            <span>{i.name}</span>
            <strong title={`Nutrition calculated from ${i.quantity_g} g`}>
              {formatFoodQuantity(
                i.quantity_g,
                context.foods.find((f) => f.id === i.food_id),
                context.units,
              )}
            </strong>
          </li>
        ))}
      </ul>
      <RecipeDetails meal={meal} context={context} />
      {locked ? (
        <p className="notice fine-print">
          {meal.status === "completed"
            ? "Meal already completed."
            : meal.status === "skipped"
              ? "Meal already skipped."
              : "This saved day has a completed or skipped meal."}{" "}
          <Link href="/dashboard">
            Undo its tracking on Today before swapping.
          </Link>
        </p>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <ArrowLeftRight size={14} /> Swap meal
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Find a meal that fits."
            description="Compare the actual rounded portion and its effect on your daily totals."
          >
            <label className="field">
              Search meals
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search meals or cuisines"
              />
            </label>
            <div className="discovery-filters">
              {(
                [
                  "Recommended",
                  "Higher Protein",
                  "Lower Calorie",
                  "Cheaper",
                  "Quick Prep",
                  "Browse All",
                ] as SwapMode[]
              ).map((m) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="swap-options">
              {candidates.map((c) => {
                const delta = targetDelta(c.meal.macros, meal.macros);
                return (
                  <button
                    key={c.template.id}
                    onClick={() => {
                      onSwap(c.template);
                      setOpen(false);
                    }}
                  >
                    <strong>{c.template.name}</strong>
                    <span>
                      {Math.round(c.meal.macros.calories)} kcal ·{" "}
                      {Math.round(c.meal.macros.protein)}g protein ·{" "}
                      {Math.round(c.meal.macros.carbs)}g carbs ·{" "}
                      {Math.round(c.meal.macros.fat)}g fat ·{" "}
                      {c.meal.cooking_minutes} min
                    </span>
                    <span>
                      {delta.calories >= 0 ? "+" : ""}
                      {Math.round(delta.calories)} kcal ·{" "}
                      {delta.protein >= 0 ? "+" : ""}
                      {Math.round(delta.protein)}g protein ·{" "}
                      {delta.fiber >= 0 ? "+" : ""}
                      {Math.round(delta.fiber)}g fiber
                    </span>
                    <small>
                      {c.estimate.cost === null
                        ? "Cost unavailable"
                        : `Demo pricing · ${money(c.estimate.cost, c.estimate.currency)} estimated ingredient cost`}{" "}
                      · Use this meal →
                    </small>
                  </button>
                );
              })}
              {!candidates.length && (
                <p className="notice">
                  No alternatives match this filter and your restrictions. Try
                  Browse All or adjust your preferences.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}
