"use client";
import type { StepProps } from "./types";
import { Choices, NumberField } from "../controls";
import { goals } from "../options";
import type { OnboardingData } from "@/lib/validation/onboarding";
export function GoalStep({ data, set }: StepProps) {
  return (
    <>
      <Choices
        value={data.goal}
        onChange={(v) => set("goal", v as OnboardingData["goal"])}
        options={goals}
      />
      <NumberField
        label={`Goal weight (${data.units === "imperial" ? "lb" : "kg"})`}
        value={data.goalWeight}
        onChange={(v) => set("goalWeight", v)}
        min={data.units === "imperial" ? 55 : 25}
        max={data.units === "imperial" ? 1102 : 500}
        step={0.1}
      />
      <label className="field">
        Timeline preference
        <select
          value={data.pace}
          onChange={(e) =>
            set("pace", e.target.value as OnboardingData["pace"])
          }
        >
          <option value="conservative">Conservative — slow and steady</option>
          <option value="moderate">Moderate — a balanced pace</option>
          <option value="aggressive">Aggressive — a larger adjustment</option>
          <option value="no_deadline">No deadline</option>
        </select>
      </label>
      <p className="notice">
        Progress isn’t linear. We won’t promise an exact outcome or
        automatically change your targets.
      </p>
    </>
  );
}
