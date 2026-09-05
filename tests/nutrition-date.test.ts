import { describe, it, expect } from "vitest";
import {
  estimateMacros,
  macroWarnings,
  sumMacros,
} from "@/lib/nutrition/macros";
import { toKg, toCm, fromKg } from "@/lib/nutrition/units";
import { localDate, mondayOf, addDays, dateSchema } from "@/lib/date";
describe("nutrition", () => {
  it("uses the documented equation and activity factor", () => {
    const e = estimateMacros({
      weightKg: 80,
      heightCm: 180,
      age: 30,
      sex: "male",
      activity: "moderate",
      goal: "maintain",
      pace: "moderate",
    });
    expect(e.bmr).toBe(1780);
    expect(e.maintenance).toBe(2759);
    expect(e.targets.calories).toBe(2760);
    expect(e.targets.fiber).toBe(39);
  });
  it("never recommends below the app safety floor", () => {
    expect(
      estimateMacros({
        weightKg: 40,
        heightCm: 140,
        age: 70,
        sex: "female",
        activity: "sedentary",
        goal: "lose",
        pace: "aggressive",
      }).targets.calories,
    ).toBe(1500);
  });
  it("flags low calories, low fat, low fiber, and energy inconsistencies", () => {
    expect(
      macroWarnings({
        calories: 1200,
        protein: 200,
        carbs: 200,
        fat: 10,
        fiber: 2,
      }).length,
    ).toBe(5);
  });
  it("normalizes and round-trips weight and height", () => {
    expect(toKg(220.46226218, "imperial")).toBeCloseTo(100);
    expect(fromKg(toKg(173, "imperial"), "imperial")).toBeCloseTo(173);
    expect(toCm(70, "imperial")).toBeCloseTo(177.8);
  });
  it("sums snapshot macros", () => {
    expect(
      sumMacros([
        { calories: 400, protein: 30, carbs: 50, fat: 9, fiber: 5 },
        { calories: 200, protein: 20, carbs: 10, fat: 9, fiber: 2 },
      ]).protein,
    ).toBe(50);
  });
});
describe("local dates and weeks", () => {
  it("uses the profile timezone, including around UTC midnight", () => {
    expect(
      localDate("America/Los_Angeles", new Date("2026-09-06T02:00:00Z")),
    ).toBe("2026-09-05");
  });
  it("uses Monday–Sunday weeks across years", () => {
    expect(mondayOf("2027-01-03")).toBe("2026-12-28");
    expect(mondayOf("2027-01-04")).toBe("2027-01-04");
  });
  it("handles leap days and DST as calendar arithmetic", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
  });
});

import {
  onboardingSchema,
  stepSchema,
  defaultOnboarding,
} from "@/lib/validation/onboarding";
import { z } from "zod";
describe("resumable onboarding", () => {
  it("validates completed steps without requiring future fields", () => {
    expect(
      stepSchema(1).safeParse({ ...defaultOnboarding, firstName: "Morgan" })
        .success,
    ).toBe(true);
    expect(stepSchema(6).safeParse(defaultOnboarding).success).toBe(false);
  });
  it("builds a partial shape safely even when the complete schema has refinements", () => {
    expect(
      z
        .object(onboardingSchema.shape)
        .partial()
        .safeParse({ firstName: "Morgan" }).success,
    ).toBe(true);
  });
});
