"use client";
import type { StepProps } from "./types";
import { goals } from "../options";
export function SummaryStep({
  data,
  set,
  targets,
  warnings,
  stores,
}: StepProps) {
  return (
    <>
      <div className={`notice ${warnings.length ? "warning" : ""}`}>
        <strong>
          {warnings.length
            ? "Your plan needs a closer look"
            : "Your starting plan looks sustainable"}
        </strong>
        <p>
          {warnings.length
            ? "Review the guidance below before continuing."
            : "Your targets pass our basic checks. Adjust based on how your routine feels."}
        </p>
      </div>
      <div className="macro-summary">
        {Object.entries(targets).map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <strong>{v.toLocaleString()}</strong>
            <small>{k === "calories" ? "kcal" : "grams"}</small>
          </div>
        ))}
      </div>
      <dl className="summary-list">
        <div>
          <dt>Your goal</dt>
          <dd>{goals.find((g) => g[0] === data.goal)?.[1]}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>
            {data.weight} → {data.goalWeight}{" "}
            {data.units === "imperial" ? "lb" : "kg"}
          </dd>
        </div>
        <div>
          <dt>Grocery budget</dt>
          <dd>${data.budget}/month</dd>
        </div>
        <div>
          <dt>Preferred stores</dt>
          <dd>
            {stores
              .filter((s) => data.stores.includes(s.id))
              .map((s) => s.name)
              .join(", ")}
          </dd>
        </div>
        <div>
          <dt>Favorite foods</dt>
          <dd>
            {[...data.proteins, ...data.carbs, ...data.vegetables]
              .filter(
                (f) =>
                  !data.excluded.some(
                    (e) => e.toLowerCase() === f.toLowerCase(),
                  ),
              )
              .join(", ") || "No favorites selected"}
          </dd>
        </div>
        <div>
          <dt>Cooking</dt>
          <dd>
            {["Very easy", "Balanced", "More variety"][data.complexity - 1]} ·{" "}
            {data.cookingMinutes} min · {data.mealsPerDay} meals/day
          </dd>
        </div>
        <div>
          <dt>Estimated grocery cost</dt>
          <dd>Available after meal planning is added</dd>
        </div>
      </dl>
      {data.budget < 150 && (
        <p className="notice warning">
          This budget may be challenging. Pantry staples, frozen vegetables, and
          flexible protein choices can help. Actual costs depend on your meals
          and local prices.
        </p>
      )}
      {warnings.map((w) => (
        <p className="notice warning" key={w}>
          {w}
        </p>
      ))}
      {warnings.length > 0 && (
        <label className="acknowledge">
          <input
            type="checkbox"
            checked={data.acknowledged}
            onChange={(e) => set("acknowledged", e.target.checked)}
            required
          />
          <span>
            I’ve reviewed these cautions and understand that these targets are
            estimates, not medical advice.
          </span>
        </label>
      )}
      <p className="fine-print muted">
        Your account starts with a clean slate. Log your first meal, water,
        workout, or weigh-in on Today.
      </p>
    </>
  );
}
