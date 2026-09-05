"use client";
import { useState } from "react";
import { Clock, ArrowLeftRight, Check } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { allowedTemplates } from "@/lib/meal-plan/restrictions";
import { scaleTemplate } from "@/lib/meal-plan/generator";
import { targetDelta } from "@/lib/meal-plan/calculations";
import type {
  PlanContext,
  PlannedMeal,
  MealTemplate,
} from "@/lib/meal-plan/types";
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
  const alternatives = allowedTemplates(
    context.templates,
    context.foods,
    context.preferences,
  ).filter((t) => t.id !== meal.template_id && t.slots.includes(meal.slot));
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
            <strong>{i.quantity_g} g</strong>
          </li>
        ))}
      </ul>
      <details>
        <summary>Preparation & instructions</summary>
        <p className="fine-print muted">
          {meal.ingredients
            .map(
              (i) =>
                `${i.name}: ${context.foods.find((f) => f.id === i.food_id)?.preparation}`,
            )
            .join(" · ")}
        </p>
        <ol>
          {meal.instructions.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            disabled={locked || alternatives.length === 0}
          >
            <ArrowLeftRight size={14} /> Swap meal
          </Button>
        </DialogTrigger>
        <DialogContent
          title="A different meal, same rhythm."
          description="Compare the impact on your daily totals before applying a swap."
        >
          <div className="swap-options">
            {alternatives.map((t) => {
              const candidate = scaleTemplate(
                t,
                context.foods,
                meal.macros.calories,
                meal.slot,
                meal.key,
              );
              const delta = targetDelta(candidate.macros, meal.macros);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSwap(t);
                    setOpen(false);
                  }}
                >
                  <strong>{t.name}</strong>
                  <span>
                    {delta.calories >= 0 ? "+" : ""}
                    {Math.round(delta.calories)} kcal ·{" "}
                    {delta.protein >= 0 ? "+" : ""}
                    {Math.round(delta.protein)}g protein ·{" "}
                    {delta.carbs >= 0 ? "+" : ""}
                    {Math.round(delta.carbs)}g carbs ·{" "}
                    {delta.fat >= 0 ? "+" : ""}
                    {Math.round(delta.fat)}g fat · {delta.fiber >= 0 ? "+" : ""}
                    {Math.round(delta.fiber)}g fiber
                  </span>
                  <small>Use this meal →</small>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
