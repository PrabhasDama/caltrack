"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "./use-mutation";
import {
  logWeight,
  deleteWeight,
  logWorkout,
  deleteWorkout,
  addMeal,
  addExtra,
} from "@/app/(app)/dashboard/actions";
import { fromKg } from "@/lib/nutrition/units";
import type { Food, Workout } from "@/types/domain";
export function WeightDialog({
  date,
  units,
  weight,
  children,
}: {
  date: string;
  units: "imperial" | "metric";
  weight?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useMutation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={weight ? "Update your weigh-in" : "A moment to check in."}
        description={`Your weight for ${date}. Daily fluctuations are normal.`}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            run(
              () => logWeight({ date, weight: Number(form.get("weight")) }),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Weight ({units === "imperial" ? "lb" : "kg"})
            <input
              name="weight"
              type="number"
              autoFocus
              step="0.1"
              min={units === "imperial" ? 55 : 25}
              max={units === "imperial" ? 1102 : 500}
              required
              defaultValue={weight ? fromKg(weight, units).toFixed(1) : ""}
              placeholder={units === "imperial" ? "165.0" : "75.0"}
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button disabled={pending}>
            {pending ? "Saving…" : "Save weight"}
          </Button>
          {weight && (
            <Button
              variant="ghost"
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => deleteWeight(date),
                  () => setOpen(false),
                )
              }
            >
              <Trash2 size={14} /> Remove this weigh-in
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function WorkoutDialog({
  date,
  workout,
  children,
}: {
  date: string;
  workout?: Workout;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useMutation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={workout ? "Your workout" : "You showed up."}
        description="A workout counts even if you leave the details blank."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                logWorkout({
                  date,
                  workout_type: f.get("type"),
                  duration_minutes: f.get("duration")
                    ? Number(f.get("duration"))
                    : null,
                  notes: f.get("notes"),
                }),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Workout type
            <select name="type" defaultValue={workout?.workout_type || "Other"}>
              {[
                "Push",
                "Pull",
                "Legs",
                "Upper",
                "Lower",
                "Cardio",
                "Sports",
                "Full Body",
                "Other",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Duration in minutes (optional)
            <input
              type="number"
              name="duration"
              min="1"
              max="600"
              defaultValue={workout?.duration_minutes || ""}
              placeholder="45"
            />
          </label>
          <label className="field">
            Notes (optional)
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={workout?.notes || ""}
              placeholder="How did it feel?"
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button disabled={pending}>
            {pending ? "Saving…" : "Save workout"}
          </Button>
          {workout && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => deleteWorkout(date),
                  () => setOpen(false),
                )
              }
            >
              <Trash2 size={14} /> Remove workout
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function FoodDialog({
  date,
  foods,
  extra = false,
  children,
}: {
  date: string;
  foods: Food[];
  extra?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ingredients, setIngredients] = useState<
    { food_id: string; quantity_g: number }[]
  >([]);
  const { pending, error, run } = useMutation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={extra ? "A little extra." : "Add a meal for today."}
        description={
          extra
            ? "Add food outside your meals. Its nutrition counts immediately."
            : "Enter your meal’s portions and nutrition. Mark it complete after you eat."
        }
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const base = {
              date,
              name: f.get("name"),
              calories: Number(f.get("calories")),
              protein: Number(f.get("protein")),
              carbs: Number(f.get("carbs")),
              fat: Number(f.get("fat")),
              fiber: Number(f.get("fiber")),
            };
            const cost = f.get("cost") ? Number(f.get("cost")) : null;
            run(
              () =>
                extra
                  ? addExtra({ ...base, cost })
                  : addMeal({
                      ...base,
                      slot: f.get("slot"),
                      estimated_cost: cost,
                      ingredients,
                    }),
              () => {
                setOpen(false);
                setIngredients([]);
              },
            );
          }}
        >
          <label className="field">
            {extra ? "Food name" : "Meal name"}
            <input
              name="name"
              maxLength={120}
              required
              placeholder={
                extra ? "Apple and peanut butter" : "Chicken rice bowl"
              }
            />
          </label>
          {!extra && (
            <label className="field">
              Meal
              <select name="slot" aria-label="Meal slot">
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snack</option>
              </select>
            </label>
          )}
          <div className="form-grid compact-grid">
            {["calories", "protein", "carbs", "fat", "fiber"].map((key) => (
              <label className="field" key={key}>
                {key[0].toUpperCase() + key.slice(1)} (
                {key === "calories" ? "kcal" : "g"})
                <input
                  type="number"
                  step="0.1"
                  name={key}
                  required
                  min={0}
                  max={
                    key === "calories"
                      ? 4000
                      : key === "protein"
                        ? 300
                        : key === "carbs"
                          ? 600
                          : key === "fat"
                            ? 250
                            : 100
                  }
                  defaultValue={0}
                />
              </label>
            ))}
            <label className="field">
              Cost ($, optional)
              <input
                type="number"
                name="cost"
                min={0}
                max={1000}
                step="0.01"
                placeholder="0.00"
              />
            </label>
          </div>
          {!extra && (
            <div className="form-stack" style={{ gap: 12 }}>
              <span className="field-label">
                Ingredients & portions (optional)
              </span>
              {ingredients.map((ingredient, i) => (
                <div className="ingredient-row" key={i}>
                  <select
                    className="input"
                    aria-label={`Ingredient ${i + 1}`}
                    required
                    value={ingredient.food_id}
                    onChange={(e) =>
                      setIngredients((v) =>
                        v.map((it, j) =>
                          j === i ? { ...it, food_id: e.target.value } : it,
                        ),
                      )
                    }
                  >
                    <option value="">Choose food</option>
                    {foods.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    aria-label={`Grams for ingredient ${i + 1}`}
                    type="number"
                    min={1}
                    max={100000}
                    required
                    value={ingredient.quantity_g || ""}
                    placeholder="grams"
                    onChange={(e) =>
                      setIngredients((v) =>
                        v.map((it, j) =>
                          j === i
                            ? { ...it, quantity_g: Number(e.target.value) }
                            : it,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Remove ingredient ${i + 1}`}
                    onClick={() =>
                      setIngredients((v) => v.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={ingredients.length >= 30}
                onClick={() =>
                  setIngredients((v) => [
                    ...v,
                    { food_id: "", quantity_g: 100 },
                  ])
                }
              >
                <Plus size={14} /> Add ingredient
              </Button>
              <p className="fine-print muted">
                Enter grams for the portion you use. Completing the meal deducts
                available pantry stock. Nutrition comes from the totals you
                enter above.
              </p>
            </div>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button disabled={pending}>
            {pending ? "Saving…" : extra ? "Add extra food" : "Add meal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
