"use client";
import type { StepProps } from "./types";
import { Choices, Multi, NumberField } from "../controls";
import type { OnboardingData } from "@/lib/validation/onboarding";
export function ActivityStep({ data, set }: StepProps) {
  return (
    <>
      <Choices
        value={data.activity}
        onChange={(v) => set("activity", v as OnboardingData["activity"])}
        options={[
          ["sedentary", "Mostly sedentary", "Most of the day sitting"],
          ["light", "Lightly active", "Some walking and light movement"],
          [
            "moderate",
            "Moderately active",
            "Regular movement throughout the day",
          ],
          ["very", "Very active", "Physically demanding days"],
        ]}
      />
      <NumberField
        label="Workouts per week"
        value={data.workoutDays}
        onChange={(v) => set("workoutDays", v)}
        min={0}
        max={7}
      />
      <div>
        <span className="field-label">Training you enjoy (optional)</span>
        <Multi
          values={data.trainingTypes}
          options={["Weight training", "Cardio", "Sports", "Mixed"]}
          onChange={(v) => set("trainingTypes", v)}
        />
      </div>
    </>
  );
}
