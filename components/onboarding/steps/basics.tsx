"use client";
import type { StepProps } from "./types";
import { Choices, NumberField } from "../controls";
import type { OnboardingData } from "@/lib/validation/onboarding";
export function BasicsStep({ data, set, changeUnits }: StepProps) {
  return (
    <>
      <label className="field">
        First name
        <input
          value={data.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          maxLength={80}
          autoComplete="given-name"
          required
          placeholder="What should we call you?"
        />
      </label>
      <div>
        <span className="field-label">Your units</span>
        <Choices
          value={data.units}
          onChange={(v) => changeUnits(v as "imperial" | "metric")}
          options={[
            ["imperial", "Imperial", "Pounds & inches"],
            ["metric", "Metric", "Kilograms & centimeters"],
          ]}
        />
      </div>
      <div className="form-grid">
        <NumberField
          label={`Starting weight (${data.units === "imperial" ? "lb" : "kg"})`}
          value={data.weight}
          onChange={(v) => set("weight", v)}
          min={data.units === "imperial" ? 55 : 25}
          max={data.units === "imperial" ? 1102 : 500}
          step={0.1}
        />
        <NumberField
          label={`Height (${data.units === "imperial" ? "total inches" : "cm"})`}
          value={data.height}
          onChange={(v) => set("height", v)}
          min={data.units === "imperial" ? 39 : 100}
          max={data.units === "imperial" ? 98 : 250}
          step={0.1}
        />
        <NumberField
          label="Age"
          value={data.age}
          onChange={(v) => set("age", v)}
          min={18}
          max={100}
        />
        <label className="field">
          Sex for calorie estimate
          <select
            value={data.sex}
            onChange={(e) =>
              set("sex", e.target.value as OnboardingData["sex"])
            }
          >
            <option value="unspecified">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <small>
            Optional. Used only for the equation; otherwise we use its midpoint.
          </small>
        </label>
      </div>
      <label className="field">
        Time zone
        <select
          value={data.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        >
          {Array.from(
            new Set([data.timezone, ...Intl.supportedValuesOf("timeZone")]),
          )
            .sort()
            .map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
        </select>
        <small>Your daily records follow this local calendar.</small>
      </label>
      <p className="notice">
        CalTrack’s estimates are designed for adults. They aren’t intended for
        pregnancy, breastfeeding, or medical nutrition needs.
      </p>
    </>
  );
}
