"use client";
import type { StepProps } from "./types";
import { NumberField } from "../controls";
import type { OnboardingData } from "@/lib/validation/onboarding";
export function BudgetStep({ data, set }: StepProps) {
  return (
    <>
      <div className="budget-presets">
        {[150, 200, 250, 300].map((v) => (
          <button
            type="button"
            key={v}
            className={`chip ${data.budget === v ? "selected" : ""}`}
            onClick={() => set("budget", v)}
          >
            ${v}
          </button>
        ))}
      </div>
      <NumberField
        label="Monthly grocery budget (USD)"
        value={data.budget}
        onChange={(v) => set("budget", v)}
        min={20}
        max={10000}
        step={1}
      />
      <p className="notice">
        That’s about ${((data.budget * 12) / 52).toFixed(0)} per week. This is
        your spending allowance, not a grocery price estimate.
      </p>
      <label className="field">
        How often do you shop?
        <select
          value={data.shoppingFrequency}
          onChange={(e) =>
            set(
              "shoppingFrequency",
              e.target.value as OnboardingData["shoppingFrequency"],
            )
          }
        >
          <option value="weekly">Weekly</option>
          <option value="twice_monthly">Twice monthly</option>
          <option value="monthly">Monthly</option>
          <option value="flexible">Flexible</option>
        </select>
      </label>
    </>
  );
}
