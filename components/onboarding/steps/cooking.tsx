"use client";
import type { StepProps } from "./types";
import type { OnboardingData } from "@/lib/validation/onboarding";
export function CookingStep({ data, set }: StepProps) {
  return (
    <>
      <label className="field">
        Meal complexity
        <input
          type="range"
          min={1}
          max={3}
          value={data.complexity}
          onChange={(e) => set("complexity", Number(e.target.value))}
        />
        <div className="range-labels">
          <span>Very easy</span>
          <span>Balanced</span>
          <span>More variety</span>
        </div>
      </label>
      <div className="form-grid">
        <label className="field">
          Time to cook
          <select
            value={data.cookingMinutes}
            onChange={(e) =>
              set(
                "cookingMinutes",
                Number(e.target.value) as OnboardingData["cookingMinutes"],
              )
            }
          >
            {[10, 20, 30, 60].map((v) => (
              <option value={v} key={v}>
                {v} minutes
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Meal prep frequency
          <select
            value={data.prepFrequency}
            onChange={(e) =>
              set(
                "prepFrequency",
                e.target.value as OnboardingData["prepFrequency"],
              )
            }
          >
            <option value="daily">Daily</option>
            <option value="twice_weekly">Twice weekly</option>
            <option value="weekly">Weekly</option>
            <option value="flexible">No preference</option>
          </select>
        </label>
        <label className="field">
          Meals per day
          <select
            value={data.mealsPerDay}
            onChange={(e) => set("mealsPerDay", Number(e.target.value))}
          >
            {[2, 3, 4, 5].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          How much variety?
          <select
            value={data.repeatTolerance}
            onChange={(e) =>
              set(
                "repeatTolerance",
                e.target.value as OnboardingData["repeatTolerance"],
              )
            }
          >
            <option value="repeat">I don’t mind repetition</option>
            <option value="some">Some variety</option>
            <option value="variety">Lots of variety</option>
          </select>
        </label>
      </div>
    </>
  );
}
