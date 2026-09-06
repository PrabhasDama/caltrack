import { describe, it, expect } from "vitest";
import {
  weightTrend,
  weightTrajectory,
  weeklySummary,
  plateauState,
  measurementToCm,
  measurementFromCm,
} from "@/lib/progress/analytics";
import { addDays } from "@/lib/date";
const series = (n: number, change = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    local_date: addDays("2026-08-01", i),
    weight_kg: 80 + i * change,
  }));
const targets = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 60,
  fiber: 30,
};
describe("progress trends and transparent denominators", () => {
  it("averages calendar days rather than seven distant observations", () => {
    const points = [
      ...series(2),
      { id: "old", local_date: "2026-08-20", weight_kg: 70 },
    ];
    expect(weightTrend(points).at(-1)?.trend).toBe(70);
    expect(weightTrend([...points].reverse())).toEqual(weightTrend(points));
  });
  it("keeps missing days unknown", () => {
    expect(weightTrend(series(0))).toEqual([]);
    expect(weightTrajectory(series(3), 70, "2026-08-03").eta).toBeNull();
  });
  it("requires enough span, recent data and movement toward the goal", () => {
    expect(
      weightTrajectory(series(8, -0.1), 70, "2026-08-08").weeklyKg,
    ).toBeNull();
    expect(weightTrajectory(series(28, -0.1), 70, "2026-09-20").eta).toBeNull();
    expect(weightTrajectory(series(28, 0.1), 70, "2026-08-28").eta).toBeNull();
    expect(weightTrajectory(series(28, 0), 70, "2026-08-28").eta).toBeNull();
  });
  it("estimates a consistent trend and suppresses maintenance ETA", () => {
    const result = weightTrajectory(series(28, -0.1), 70, "2026-08-28");
    expect(result.weeklyKg).toBeLessThan(-0.5);
    expect(result.eta).toMatch(/^2026-/);
    expect(
      weightTrajectory(series(28, -0.1), 70, "2026-08-28", true).eta,
    ).toBeNull();
  });
  it("requires three weeks and actual tracking before a plateau message", () => {
    const entries = series(21);
    expect(plateauState(entries, "2026-08-21", [])).toBe("insufficient");
    expect(
      plateauState(
        entries,
        "2026-08-21",
        entries.map((e) => e.local_date),
      ),
    ).toBe("stable");
    expect(
      plateauState(
        series(21, -0.1),
        "2026-08-21",
        entries.map((e) => e.local_date),
      ),
    ).toBe("changing");
    expect(
      plateauState(
        series(8),
        "2026-08-08",
        entries.map((e) => e.local_date),
      ),
    ).toBe("insufficient");
  });
  it("uses only consumed food, separate currencies and elapsed calendar pace", () => {
    const s = weeklySummary({
      today: "2026-09-09",
      week: "2026-09-07",
      targets,
      meals: [
        { ...targets, local_date: "2026-09-07", status: "completed" },
        { ...targets, local_date: "2026-09-08", status: "skipped" },
      ],
      extras: [],
      weights: [],
      workouts: [{ local_date: "2026-09-08" }],
      purchases: [
        { purchased_on: "2026-09-07", total: 20, currency: "USD" },
        { purchased_on: "2026-09-07", total: 100, currency: "CAD" },
      ],
      budget: 300,
      currency: "USD",
      workoutTarget: 3,
    });
    expect(s.trackedDays).toBe(1);
    expect(s.span).toBe(3);
    expect(s.average.calories).toBe(2000);
    expect(s.hits.protein).toBe(1);
    expect(s.completed).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.planned).toBe(2);
    expect(s.spend).toBe(20);
    expect(s.budgetPace).toBe(30);
    expect(s.nutritionState).toBe("Insufficient data");
    expect(s.workouts).toBe(1);
  });
  it("converts measurements without changing canonical centimeters", () => {
    expect(measurementToCm(32, "imperial")).toBeCloseTo(81.28);
    expect(measurementFromCm(81.28, "imperial")).toBeCloseTo(32);
    expect(measurementToCm(81.28, "metric")).toBe(81.28);
  });
});
