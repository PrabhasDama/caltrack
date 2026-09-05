"use client";
import type { StepProps } from "./types";
import { Choices, NumberField } from "../controls";
import type { OnboardingData } from "@/lib/validation/onboarding";
import type { Macros } from "@/lib/nutrition/macros";
import { SlidersHorizontal } from "lucide-react";
export function MacrosStep({
  data,
  set,
  setData,
  estimate,
  warnings,
}: StepProps) {
  return (
    <>
      <Choices
        value={data.macroMode}
        onChange={(v) => {
          if (v === "manual" && data.macroMode === "recommended")
            setData((d) => ({
              ...d,
              macros: estimate.targets,
              macroMode: "manual",
              acknowledged: false,
            }));
          else set("macroMode", v as OnboardingData["macroMode"]);
        }}
        options={[
          [
            "recommended",
            "Recommended for me",
            "A transparent, formula-based starting point",
          ],
          [
            "manual",
            "I know my macros",
            "Use or customize your own daily targets",
          ],
        ]}
      />
      <div className="macro-summary">
        {Object.entries(estimate.targets).map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <strong>{v.toLocaleString()}</strong>
            <small>{k === "calories" ? "kcal" : "grams"}</small>
          </div>
        ))}
      </div>
      <p className="muted fine-print">
        Recommended: Mifflin–St Jeor resting estimate of{" "}
        {estimate.bmr.toLocaleString()} kcal × {estimate.activityFactor}{" "}
        activity factor = {estimate.maintenance.toLocaleString()} kcal
        maintenance. Goal adjustment: {Math.round((estimate.factor - 1) * 100)}
        %. Protein: up to 1.6 g/kg, fat: 28% of calories, fiber: 14 g/1,000
        kcal. Workout frequency is not added again. Estimates have a 1,500 kcal
        floor.
      </p>
      {data.macroMode === "manual" && (
        <>
          <div className="field-label">
            Your targets · compare with recommended above
          </div>
          <div className="form-grid">
            {(Object.keys(data.macros) as (keyof Macros)[]).map((key) => (
              <NumberField
                key={key}
                label={
                  key === "calories"
                    ? "Calories (kcal)"
                    : `${key[0].toUpperCase() + key.slice(1)} (g)`
                }
                value={data.macros[key]}
                onChange={(v) => set("macros", { ...data.macros, [key]: v })}
                min={
                  key === "calories"
                    ? 1200
                    : key === "protein"
                      ? 20
                      : key === "fat"
                        ? 10
                        : 0
                }
                max={
                  key === "calories"
                    ? 8000
                    : key === "protein"
                      ? 500
                      : key === "carbs"
                        ? 1200
                        : key === "fat"
                          ? 400
                          : 100
                }
              />
            ))}
          </div>
          <button
            type="button"
            className="button"
            onClick={() => set("macros", estimate.targets)}
          >
            <SlidersHorizontal size={15} /> Copy recommended targets
          </button>
        </>
      )}
      <NumberField
        label="Daily water target (mL)"
        value={data.waterMl}
        onChange={(v) => set("waterMl", v)}
        min={500}
        max={6000}
        step={250}
      />
      {warnings.map((w) => (
        <p className="notice warning" key={w}>
          {w}
        </p>
      ))}
      <p className="fine-print muted">
        Educational estimates, not medical advice. A registered dietitian can
        help personalize targets for your circumstances.
      </p>
    </>
  );
}
